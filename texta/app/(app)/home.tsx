import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { router } from "expo-router";

export default function Home() {
    const { logout, user } = useAuth();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Home</Text>

            {user && (
                <Text style={styles.subtitle}>Welcome, {user.username || user.email}!</Text>
            )}

            <Pressable
                onPress={async () => {
                    await logout();
                    router.replace("/");
                }}
                style={styles.button}
            >
                <Text style={styles.buttonText}>Logout</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#fff",
        alignItems: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: "#4b5563",
        marginBottom: 24,
    },
    button: {
        backgroundColor: "#dc2626", // Red for logout
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 12,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
