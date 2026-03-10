import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
} from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TouchableWithoutFeedback,
    TextInput,
    Keyboard,
    Platform,
    FlatList,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    Animated,
    Image,
    LayoutAnimation,
    UIManager,
    Linking,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { getAllLists, createList, deleteList, deleteMultipleLists, updateList, updateListStatus, scheduleDeleteList, generateUploadURLs, getListById } from "../../services/api";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ListItem {
    _id: string;
    text: string;
    description?: string;
    url?: string[];
    status: "pending" | "in-progress" | "done";
    createdAt: string;
    updatedAt: string;
    // optimistic helpers
    _pending?: boolean;
    _failed?: boolean;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

const getStatusLineColor = (status: ListItem["status"]) => {
    if (status === "done") return "#22c55e";
    if (status === "in-progress") return "#38bdf8";
    return "#9ca3af";
};

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Home() {
    const { logout, user } = useAuth();

    // UI state
    const [menuOpen, setMenuOpen] = useState(false);
    const [keyboardBottom, setKeyboardBottom] = useState(24);

    // Chat state
    const [lists, setLists] = useState<ListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Input state
    const [inputText, setInputText] = useState("");
    const [sending, setSending] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);

    // Edit state
    const [editingItem, setEditingItem] = useState<ListItem | null>(null);
    const [editText, setEditText] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    // Context-menu state (long-press)
    const [contextItem, setContextItem] = useState<ListItem | null>(null);
    const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
    const [expandedListIds, setExpandedListIds] = useState<string[]>([]);
    const [timerItem, setTimerItem] = useState<ListItem | null>(null);
    const [timerDuration, setTimerDuration] = useState("");
    const [timerSaving, setTimerSaving] = useState(false);

    const flatRef = useRef<FlatList>(null);
    const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

    // â”€â”€ Keyboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        const showEv = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEv = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const show = Keyboard.addListener(showEv, (e) => {
            setKeyboardBottom(e.endCoordinates.height + 25);
        });
        const hide = Keyboard.addListener(hideEv, () => setKeyboardBottom(24));
        return () => { show.remove(); hide.remove(); };
    }, []);

    useEffect(() => {
        const isNewArchitecture = !!(globalThis as any).nativeFabricUIManager;
        if (Platform.OS === "android" && !isNewArchitecture && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    // â”€â”€ Fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchLists = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await getAllLists();
            setLists(res.data.data ?? []);
        } catch {
            // silently fail on refresh
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchLists(); }, [fetchLists]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchLists(true);
    };

    // â”€â”€ Select File â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
                multiple: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setSelectedFiles((prev) => {
                    const merged = [...prev, ...result.assets];
                    const seen = new Set<string>();
                    return merged.filter((file) => {
                        const key = `${file.uri}-${file.name}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                });
            }
        } catch {
            Alert.alert("Error", "Could not pick file");
        }
    };

    // â”€â”€ Send â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleSend = async () => {
        const text = inputText.trim();
        if ((!text && selectedFiles.length === 0) || sending) return;

        const optimisticId = `opt-${Date.now()}`;
        const optimistic: ListItem = {
            _id: optimisticId,
            text,
            status: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _pending: true,
        };

        setLists((prev) => [optimistic, ...prev]);
        setInputText("");
        const filesToUpload = [...selectedFiles];
        setSelectedFiles([]);
        Keyboard.dismiss();
        setSending(true);

        try {
            // 1. Create List
            const res = await createList({
                text: text || (filesToUpload.length > 0 ? filesToUpload[0].name : "")
            });
            let created: ListItem = res.data.data;

            // 2. Upload files if needed
            if (filesToUpload.length > 0 && created._id) {
                const presignedRes = await generateUploadURLs(
                    created._id,
                    filesToUpload.map((file) => file.name)
                );

                const { presignedUrls } = presignedRes.data.data;

                await Promise.all(
                    presignedUrls.map(async (uploadUrl: string, index: number) => {
                        const file = filesToUpload[index];
                        if (!uploadUrl || !file) return;

                        const fileResp = await fetch(file.uri);
                        const blob = await fileResp.blob();
                        const uploadResp = await fetch(uploadUrl, {
                        method: "PUT",
                        body: blob,
                        headers: {
                                "Content-Type": file.mimeType || "application/octet-stream"
                        }
                        });
                        if (!uploadResp.ok) {
                            throw new Error(`Upload failed for ${file.name}`);
                        }
                    })
                );

                const updatedListRes = await getListById(created._id);
                created = updatedListRes.data.data;
            }

            setLists((prev) =>
                prev.map((l) => (l._id === optimisticId ? created : l))
            );
        } catch (error) {
            console.error(error);
            // Mark as failed
            setLists((prev) =>
                prev.map((l) =>
                    l._id === optimisticId ? { ...l, _pending: false, _failed: true } : l
                )
            );
        } finally {
            setSending(false);
        }
    };

    // â”€â”€ Retry failed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleRetry = async (item: ListItem) => {
        setLists((prev) =>
            prev.map((l) => (l._id === item._id ? { ...l, _pending: true, _failed: false } : l))
        );
        try {
            const res = await createList({ text: item.text });
            const created: ListItem = res.data.data;
            setLists((prev) => prev.map((l) => (l._id === item._id ? created : l)));
        } catch {
            setLists((prev) =>
                prev.map((l) =>
                    l._id === item._id ? { ...l, _pending: false, _failed: true } : l
                )
            );
        }
    };

    // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleDelete = async (item: ListItem) => {
        setContextItem(null);
        if (item._pending || item._failed) {
            setLists((prev) => prev.filter((l) => l._id !== item._id));
            return;
        }
        Alert.alert("Delete message", "This message will be permanently deleted.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    setLists((prev) => prev.filter((l) => l._id !== item._id));
                    try {
                        await deleteList(item._id);
                    } catch {
                        // Revert
                        setLists((prev) => [item, ...prev]);
                        Alert.alert("Error", "Could not delete. Please try again.");
                    }
                },
            },
        ]);
    };

    const isSelectionMode = selectedListIds.length > 0;

    const toggleListSelection = (itemId: string) => {
        setSelectedListIds((prev) =>
            prev.includes(itemId)
                ? prev.filter((id) => id !== itemId)
                : [...prev, itemId]
        );
    };

    const openMultiSelect = (item: ListItem) => {
        setContextItem(null);
        if (item._pending || item._failed) return;
        setSelectedListIds((prev) => (prev.includes(item._id) ? prev : [...prev, item._id]));
    };

    const clearSelection = () => {
        setSelectedListIds([]);
    };

    const handleBulkDelete = () => {
        if (selectedListIds.length === 0) return;
        const idsToDelete = [...selectedListIds];
        const previousLists = [...lists];

        Alert.alert(
            "Delete selected messages",
            `Delete ${idsToDelete.length} selected message${idsToDelete.length > 1 ? "s" : ""}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setLists((prev) => prev.filter((l) => !idsToDelete.includes(l._id)));
                        clearSelection();
                        try {
                            await deleteMultipleLists(idsToDelete);
                        } catch {
                            setLists(previousLists);
                            Alert.alert("Error", "Could not delete selected messages. Please try again.");
                        }
                    },
                },
            ]
        );
    };

    // â”€â”€ Edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const openEdit = (item: ListItem) => {
        setContextItem(null);
        setEditingItem(item);
        setEditText(item.text);
    };

    const handleCopyListContent = async (item: ListItem) => {
        setContextItem(null);
        const content = item.text?.trim();
        if (!content) {
            Alert.alert("Nothing to copy", "This list has no text content.");
            return;
        }

        try {
            await Clipboard.setStringAsync(content);
        } catch {
            Alert.alert("Error", "Could not copy list content.");
        }
    };

    const handleSaveEdit = async () => {
        if (!editingItem || !editText.trim() || editSaving) return;
        setEditSaving(true);
        try {
            const res = await updateList(editingItem._id, { text: editText.trim() });
            const updated: ListItem = res.data.data;
            setLists((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
            setEditingItem(null);
        } catch {
            Alert.alert("Error", "Could not save changes.");
        } finally {
            setEditSaving(false);
        }
    };

    const handleChangeStatus = async (item: ListItem, status: ListItem["status"]) => {
        if (item._pending || item._failed || item.status === status) return;

        const previousStatus = item.status;
        setLists((prev) => prev.map((l) => (l._id === item._id ? { ...l, status } : l)));

        try {
            await updateListStatus(item._id, status);
        } catch {
            setLists((prev) => prev.map((l) => (l._id === item._id ? { ...l, status: previousStatus } : l)));
            Alert.alert("Error", "Could not update status.");
        }
    };

    const openTimerForList = (item: ListItem) => {
        if (item._pending || item._failed) return;
        setTimerItem(item);
        setTimerDuration("");
    };

    const closeTimerModal = () => {
        if (timerSaving) return;
        setTimerItem(null);
        setTimerDuration("");
    };

    const handleSaveTimer = async () => {
        if (!timerItem || timerSaving) return;

        const duration = timerDuration.trim().toLowerCase();
        if (!/^\d+(s|m|h|d)$/.test(duration)) {
            Alert.alert("Invalid duration", "Use values like 20s, 25m, 3h, or 1d.");
            return;
        }

        setTimerSaving(true);
        try {
            await scheduleDeleteList(timerItem._id, duration);
            closeTimerModal();
            Alert.alert("Timer added", `List will be deleted in ${duration}.`);
        } catch {
            Alert.alert("Error", "Could not schedule delete timer.");
        } finally {
            setTimerSaving(false);
        }
    };

    const toggleExpanded = (itemId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedListIds((prev) =>
            prev.includes(itemId)
                ? prev.filter((id) => id !== itemId)
                : [...prev, itemId]
        );
    };

    const closeSwipeFor = (itemId: string) => {
        swipeableRefs.current[itemId]?.close();
    };

    const toPublicFileUrl = (fileKey: string) => `https://texta.in.s3.ap-south-1.amazonaws.com/${fileKey}`;

    const handleOpenAttachment = async (fileKey: string) => {
        const fileUrl = toPublicFileUrl(fileKey);
        try {
            const supported = await Linking.canOpenURL(fileUrl);
            if (!supported) {
                Alert.alert("Can't open file", "No app available to open this file.");
                return;
            }
            await Linking.openURL(fileUrl);
        } catch {
            Alert.alert("Error", "Could not open file.");
        }
    };

    // â”€â”€ Logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleLogout = async () => {
        setMenuOpen(false);
        await logout();
        router.replace("/");
    };

    // â”€â”€ Render rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const renderRow = ({ item }: { item: ListItem }) => {
        const isPending = !!item._pending;
        const isFailed = !!item._failed;
        const isSelected = selectedListIds.includes(item._id);
        const isExpanded = expandedListIds.includes(item._id);

        const fileUrls: string[] = item.url || [];
        const fileName = fileUrls.length > 0 ? (fileUrls[0].split("_").pop() || "Attachment") : "Attachment";
        const disableSwipe = isSelectionMode || isPending || isFailed;
        const statusLineColor = getStatusLineColor(item.status);

        const renderTimerAction = () => (
            <View style={styles.swipeActionLeftWrap}>
                <Pressable
                    style={styles.swipeActionTimer}
                    onPress={() => {
                        closeSwipeFor(item._id);
                        openTimerForList(item);
                    }}
                    disabled={disableSwipe}
                >
                    <Ionicons name="time-outline" size={16} color="#fff" />
                    <Text style={styles.swipeActionText}>Timer</Text>
                </Pressable>
            </View>
        );

        const renderStatusActions = () => (
            <View style={styles.swipeActionRightWrap}>
                <Pressable
                    style={[styles.swipeActionStatus, { backgroundColor: "#9ca3af" }]}
                    onPress={() => {
                        closeSwipeFor(item._id);
                        handleChangeStatus(item, "pending");
                    }}
                    disabled={disableSwipe}
                >
                    <Text style={styles.swipeActionText}>Pending</Text>
                </Pressable>
                <Pressable
                    style={[styles.swipeActionStatus, { backgroundColor: "#38bdf8" }]}
                    onPress={() => {
                        closeSwipeFor(item._id);
                        handleChangeStatus(item, "in-progress");
                    }}
                    disabled={disableSwipe}
                >
                    <Text style={styles.swipeActionText}>In Progress</Text>
                </Pressable>
                <Pressable
                    style={[styles.swipeActionStatus, { backgroundColor: "#22c55e" }]}
                    onPress={() => {
                        closeSwipeFor(item._id);
                        handleChangeStatus(item, "done");
                    }}
                    disabled={disableSwipe}
                >
                    <Text style={styles.swipeActionText}>Done</Text>
                </Pressable>
            </View>
        );

        return (
            <Swipeable
                ref={(ref) => {
                    swipeableRefs.current[item._id] = ref;
                }}
                enabled={!disableSwipe}
                renderLeftActions={renderTimerAction}
                renderRightActions={renderStatusActions}
                leftThreshold={36}
                rightThreshold={54}
            >
                <Pressable
                    onPress={() => {
                        if (isPending || isFailed) return;
                        if (isSelectionMode) {
                            toggleListSelection(item._id);
                            return;
                        }
                        toggleExpanded(item._id);
                    }}
                    onLongPress={() => {
                        if (isPending || isFailed) return;
                        if (isSelectionMode) {
                            toggleListSelection(item._id);
                            return;
                        }
                        setContextItem(item);
                    }}
                    delayLongPress={300}
                    style={({ pressed }) => [
                        styles.listRowPressable,
                        pressed && styles.listRowPressed,
                    ]}
                >
                    <View style={[
                        styles.listCard,
                        isSelected && styles.listCardSelected,
                    ]}>
                    <View style={[styles.listStatusLine, { backgroundColor: statusLineColor }]} />
                    <View style={styles.listCardBody}>
                        <Text
                            style={styles.listPreviewText}
                            numberOfLines={isExpanded ? undefined : 4}
                        >
                            {item.text?.trim() || fileName}
                        </Text>

                        {fileUrls.length > 0 && isExpanded && (
                            <View style={styles.attachmentList}>
                                {fileUrls.map((fileKey) => {
                                    const fileUrl = toPublicFileUrl(fileKey);
                                    const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(fileKey);
                                    const attachmentName = fileKey.split("_").pop() || "Attachment";
                                    return (
                                        <Pressable
                                            key={fileKey}
                                            style={({ pressed }) => [styles.attachmentRow, pressed && { opacity: 0.8 }]}
                                            onPress={() => handleOpenAttachment(fileKey)}
                                        >
                                            {isImage ? (
                                                <Image
                                                    source={{ uri: fileUrl }}
                                                    style={styles.attachmentImage}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View style={styles.attachmentIconWrap}>
                                                    <Ionicons name="document-text-outline" size={18} color="#374151" />
                                                </View>
                                            )}
                                            <Text style={styles.attachmentName} numberOfLines={1}>{attachmentName}</Text>
                                            <Ionicons name="open-outline" size={16} color="#6b7280" />
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                        {isFailed && (
                            <Pressable onPress={() => handleRetry(item)} style={styles.retryInlineBtn}>
                                <Ionicons name="alert-circle" size={15} color="#dc2626" />
                                <Text style={styles.retryInlineText}>Retry</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
                </Pressable>
            </Swipeable>
        );
    };

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>

            {/* â”€â”€ Header â”€â”€ */}
            <View style={styles.header}>
                <Text style={styles.logoText}>Texta</Text>

                <View>
                    <Pressable
                        onPress={() => setMenuOpen((o) => !o)}
                        style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.5 }]}
                        hitSlop={8}
                    >
                        <Ionicons name="person-outline" size={24} color="#111827" />
                    </Pressable>

                    {menuOpen && (
                        <>
                            <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
                                <View style={styles.menuOverlay} />
                            </TouchableWithoutFeedback>
                            <View style={styles.dropdown}>
                                {user && (
                                    <View style={styles.dropdownHeader}>
                                        <Ionicons name="person-outline" size={22} color="#111827" />
                                        <View style={{ marginLeft: 8 }}>
                                            <Text style={styles.dropdownName}>{user.username}</Text>
                                            <Text style={styles.dropdownEmail}>{user.email}</Text>
                                        </View>
                                    </View>
                                )}
                                <View style={styles.divider} />
                                <Pressable
                                    onPress={handleLogout}
                                    style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: "#f3f4f6" }]}
                                >
                                    <Ionicons name="log-out-outline" size={18} color="#111827" />
                                    <Text style={styles.dropdownItemText}>Logout</Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>
            </View>

            {isSelectionMode && (
                <View style={styles.selectionBar}>
                    <Text style={styles.selectionCount}>
                        {selectedListIds.length} selected
                    </Text>
                    <View style={styles.selectionActions}>
                        <Pressable onPress={clearSelection} style={styles.selectionCancelBtn}>
                            <Text style={styles.selectionCancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable onPress={handleBulkDelete} style={styles.selectionDeleteBtn}>
                            <Ionicons name="trash-outline" size={15} color="#fff" />
                            <Text style={styles.selectionDeleteText}>Delete</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {/* â”€â”€ Message list â”€â”€ */}
            <View style={[styles.listWrapper, { marginBottom: keyboardBottom + 64 }]}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="small" color="#9ca3af" />
                    </View>
                ) : lists.length === 0 ? (
                    <View style={styles.center}>
                        <Ionicons name="list-outline" size={52} color="#e5e7eb" />
                        <Text style={styles.emptyTitle}>No lists yet</Text>
                        <Text style={styles.emptySubtitle}>Create one below to get started</Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatRef}
                        data={lists}
                        keyExtractor={(item) => item._id}
                        renderItem={renderRow}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor="#9ca3af"
                            />
                        }
                    />
                )}
            </View>

            {/* â”€â”€ Floating Input Bar â”€â”€ */}
            <View style={[styles.inputContainer, { bottom: keyboardBottom }]}>
                {selectedFiles.length > 0 && (
                    <View style={styles.selectedFilePill}>
                        <Ionicons name="document-text" size={16} color="#4b5563" />
                        <Text style={styles.selectedFileText} numberOfLines={1}>
                            {selectedFiles.length === 1
                                ? selectedFiles[0].name
                                : `${selectedFiles.length} files selected`}
                        </Text>
                        <Pressable onPress={() => setSelectedFiles([])} hitSlop={10}>
                            <Ionicons name="close-circle" size={18} color="#9ca3af" />
                        </Pressable>
                    </View>
                )}

                <View style={styles.inputBar}>
                    <Pressable
                        onPress={handlePickFile}
                        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}
                    >
                        <Ionicons name="add" size={22} color="#111827" />
                    </Pressable>

                    <TextInput
                        style={styles.input}
                        placeholder="Message..."
                        placeholderTextColor="#9ca3af"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        returnKeyType="default"
                    />

                    <Pressable
                        onPress={handleSend}
                        disabled={sending || (!inputText.trim() && selectedFiles.length === 0)}
                        style={({ pressed }) => [
                            styles.sendBtn,
                            (inputText.trim() || selectedFiles.length > 0) && styles.sendBtnActive,
                            pressed && { opacity: 0.7 },
                        ]}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#9ca3af" />
                        ) : (
                            <Ionicons
                                name="arrow-up"
                                size={18}
                                color={(inputText.trim() || selectedFiles.length > 0) ? "#fff" : "#9ca3af"}
                            />
                        )}
                    </Pressable>
                </View>
            </View>

            {/* â”€â”€ Context menu (long-press) â”€â”€ */}
            <Modal
                visible={!!contextItem}
                transparent
                animationType="fade"
                onRequestClose={() => setContextItem(null)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setContextItem(null)}>
                    <View style={styles.contextMenu}>
                        {/* Preview text */}
                        <View style={styles.contextPreview}>
                            <Text style={styles.contextPreviewText} numberOfLines={2}>
                                {contextItem?.text}
                            </Text>
                        </View>
                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.contextItem, pressed && { backgroundColor: "#f3f4f6" }]}
                            onPress={() => contextItem && openEdit(contextItem)}
                        >
                            <Ionicons name="pencil-outline" size={18} color="#111827" />
                            <Text style={styles.contextItemText}>Edit</Text>
                        </Pressable>

                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.contextItem, pressed && { backgroundColor: "#f3f4f6" }]}
                            onPress={() => contextItem && handleCopyListContent(contextItem)}
                        >
                            <Ionicons name="copy-outline" size={18} color="#111827" />
                            <Text style={styles.contextItemText}>Copy</Text>
                        </Pressable>

                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.contextItem, pressed && { backgroundColor: "#f3f4f6" }]}
                            onPress={() => contextItem && openMultiSelect(contextItem)}
                        >
                            <Ionicons name="checkmark-done-outline" size={18} color="#111827" />
                            <Text style={styles.contextItemText}>Select</Text>
                        </Pressable>

                        <View style={styles.divider} />

                        <Pressable
                            style={({ pressed }) => [styles.contextItem, pressed && { backgroundColor: "#fff5f5" }]}
                            onPress={() => contextItem && handleDelete(contextItem)}
                        >
                            <Ionicons name="trash-outline" size={18} color="#dc2626" />
                            <Text style={[styles.contextItemText, { color: "#dc2626" }]}>Delete</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            {/* â”€â”€ Edit Modal â”€â”€ */}
            <Modal
                visible={!!editingItem}
                transparent
                animationType="slide"
                onRequestClose={() => setEditingItem(null)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setEditingItem(null)}>
                    <Pressable style={styles.editSheet} onPress={() => { }}>
                        <View style={styles.editHandle} />
                        <Text style={styles.editTitle}>Edit message</Text>

                        <TextInput
                            style={styles.editInput}
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                            autoFocus
                            placeholder="Message"
                            placeholderTextColor="#9ca3af"
                        />

                        <View style={styles.editActions}>
                            <Pressable
                                onPress={() => setEditingItem(null)}
                                style={styles.editCancelBtn}
                            >
                                <Text style={styles.editCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveEdit}
                                disabled={editSaving || !editText.trim()}
                                style={[styles.editSaveBtn, (!editText.trim() || editSaving) && { opacity: 0.5 }]}
                            >
                                {editSaving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.editSaveText}>Save</Text>
                                )}
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={!!timerItem}
                transparent
                animationType="slide"
                onRequestClose={closeTimerModal}
            >
                <Pressable style={styles.modalBackdrop} onPress={closeTimerModal}>
                    <Pressable style={styles.editSheet} onPress={() => { }}>
                        <View style={styles.editHandle} />
                        <Text style={styles.editTitle}>Add delete timer</Text>
                        <Text style={styles.timerHint}>Enter duration like 1d, 3h, 25m or 20s.</Text>

                        <TextInput
                            style={styles.editInput}
                            value={timerDuration}
                            onChangeText={setTimerDuration}
                            autoFocus
                            placeholder="e.g. 1d"
                            placeholderTextColor="#9ca3af"
                            autoCapitalize="none"
                        />

                        <View style={styles.editActions}>
                            <Pressable
                                onPress={closeTimerModal}
                                style={styles.editCancelBtn}
                            >
                                <Text style={styles.editCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveTimer}
                                disabled={timerSaving || !timerDuration.trim()}
                                style={[styles.editSaveBtn, (!timerDuration.trim() || timerSaving) && { opacity: 0.5 }]}
                            >
                                {timerSaving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.editSaveText}>Set Timer</Text>
                                )}
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

        </SafeAreaView>
    );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fff" },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        zIndex: 20,
    },
    logoText: {
        fontSize: 26,
        fontWeight: "800",
        color: "#111827",
        letterSpacing: -0.8,
    },
    avatarBtn: { padding: 4 },
    selectionBar: {
        marginHorizontal: 16,
        marginBottom: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        backgroundColor: "#f9fafb",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    selectionCount: {
        fontSize: 13,
        fontWeight: "600",
        color: "#111827",
    },
    selectionActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    selectionCancelBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: "#e5e7eb",
    },
    selectionCancelText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#374151",
    },
    selectionDeleteBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: "#dc2626",
    },
    selectionDeleteText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#fff",
    },

    // Dropdown
    menuOverlay: {
        position: "absolute",
        top: 0, left: -1000, right: -1000, bottom: -2000,
        zIndex: 30,
    },
    dropdown: {
        position: "absolute",
        top: 40, right: 0,
        width: 210,
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 40,
        overflow: "hidden",
    },
    dropdownHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dropdownName: { fontSize: 14, fontWeight: "700", color: "#111827" },
    dropdownEmail: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
    divider: { height: 1, backgroundColor: "#f3f4f6" },
    dropdownItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 13,
    },
    dropdownItemText: { fontSize: 14, fontWeight: "600", color: "#111827" },

    // Empty / loading
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingBottom: 100,
    },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
    emptySubtitle: { fontSize: 13, color: "#9ca3af" },

    // List wrapper â€” shrinks when keyboard opens, lifting the chat
    listWrapper: {
        flex: 1,
    },

    // FlatList
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },

    listRowPressable: {
        marginBottom: 10,
    },
    listRowPressed: {
        opacity: 0.85,
    },
    listCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        backgroundColor: "#f3f4f6",
        overflow: "hidden",
    },
    listCardSelected: {
        borderColor: "#60a5fa",
        backgroundColor: "#eef6ff",
    },
    listStatusLine: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 5,
    },
    listCardBody: {
        paddingVertical: 13,
        paddingHorizontal: 14,
        paddingLeft: 16,
    },
    listPreviewText: {
        fontSize: 16,
        lineHeight: 23,
        color: "#1f2937",
    },
    attachmentList: {
        marginTop: 8,
        gap: 8,
    },
    attachmentRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 10,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        padding: 8,
        gap: 8,
    },
    attachmentIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
        justifyContent: "center",
    },
    attachmentImage: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: "#d1d5db",
    },
    attachmentName: {
        flex: 1,
        fontSize: 13,
        fontWeight: "500",
        color: "#374151",
    },
    retryInlineBtn: {
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
    },
    retryInlineText: {
        fontSize: 12,
        color: "#dc2626",
        fontWeight: "600",
    },
    swipeActionLeftWrap: {
        justifyContent: "center",
        marginBottom: 10,
        marginRight: 8,
    },
    swipeActionRightWrap: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
        marginLeft: 8,
        gap: 6,
    },
    swipeActionTimer: {
        width: 76,
        height: "100%",
        borderRadius: 14,
        backgroundColor: "#0f766e",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
    },
    swipeActionStatus: {
        width: 78,
        height: "100%",
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
    },
    swipeActionText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
        textAlign: "center",
    },

    // Input bar wrapper
    inputContainer: {
        position: "absolute",
        left: 16, right: 16,
    },
    selectedFilePill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        alignSelf: "flex-start",
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 4,
        gap: 8,
        maxWidth: "100%",
    },
    selectedFileText: {
        fontSize: 13,
        fontWeight: "500",
        color: "#374151",
        flexShrink: 1,
    },
    inputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: 30,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    iconBtn: {
        width: 36, height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f3f4f6",
    },
    input: {
        flex: 1,
        minHeight: 36,
        maxHeight: 110,
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 8,
        fontSize: 15,
        color: "#111827",
    },
    sendBtn: {
        width: 36, height: 36,
        borderRadius: 18,
        backgroundColor: "#e5e7eb",
        alignItems: "center",
        justifyContent: "center",
    },
    sendBtnActive: {
        backgroundColor: "#111827",
    },

    // Context menu modal
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
    },
    contextMenu: {
        width: 240,
        backgroundColor: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
    },
    contextPreview: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    contextPreviewText: {
        fontSize: 14,
        color: "#6b7280",
        lineHeight: 20,
    },
    contextItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    contextItemText: {
        fontSize: 15,
        fontWeight: "500",
        color: "#111827",
    },

    // Edit bottom sheet
    editSheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === "ios" ? 36 : 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 12,
    },
    editHandle: {
        width: 36, height: 4,
        borderRadius: 2,
        backgroundColor: "#e5e7eb",
        alignSelf: "center",
        marginBottom: 16,
    },
    editTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 14,
    },
    timerHint: {
        fontSize: 12,
        color: "#6b7280",
        marginBottom: 10,
    },
    editInput: {
        minHeight: 80,
        backgroundColor: "#f9fafb",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: "#111827",
        textAlignVertical: "top",
        marginBottom: 16,
    },
    editActions: {
        flexDirection: "row",
        gap: 10,
    },
    editCancelBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
    },
    editCancelText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
    editSaveBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: "#111827",
        alignItems: "center",
    },
    editSaveText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});

