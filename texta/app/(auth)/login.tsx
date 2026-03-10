import { Text, View, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Link, Redirect } from "expo-router";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
    const { login, isAuthenticated } = useAuth();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    if (isAuthenticated) {
        return <Redirect href="/(app)/home" />;
    }

    const onLogin = async () => {
        if (!identifier || !password) {
            setError("Please fill in all fields.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            await login(identifier, password);
        } catch (err: any) {
            setError(err?.response?.data?.message || err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Login</Text>
            <TextInput
                style={styles.input}
                placeholder="Email or username"
                autoCapitalize="none"
                value={identifier}
                onChangeText={setIdentifier}
            />
            <View style={styles.passwordContainer}>
                <TextInput
                    style={styles.passwordInput}
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
                </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={onLogin} style={styles.button} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
            </Pressable>
            <Link href="/(auth)/register" style={styles.link}>
                Create account
            </Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#fff",
        gap: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    passwordContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 10,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    eyeButton: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    eyeText: {
        fontSize: 18,
    },
    button: {
        backgroundColor: "#111827",
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    link: {
        marginTop: 6,
        color: "#2563eb",
        textAlign: "center",
    },
    error: {
        color: "#dc2626",
    },
});