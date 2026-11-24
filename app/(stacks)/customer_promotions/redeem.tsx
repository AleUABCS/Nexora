import { colors, globalStyles } from "@/constants/global_styles";
import appFirebase from "@/credentials";
import { router, useLocalSearchParams } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

const chip_icon = require("../../../assets/images/chip.png");

export default function RedeemView() {
  const [code, setCode] = useState<string>("");
  const [loadingCode, setLoadingCode] = useState(true);
  const { promotion_id, business_id } = useLocalSearchParams();
  const promotionId = promotion_id as string;
  const businessId = business_id as string;

  const initialized = useRef(false);

// Busca un código del usuario para esta promoción que no esté usado ni vencido
const findActiveCode = async (userId: string, promoId: string) => {
  const q = query(
    collection(db, "validationCodes"),
    where("user_id", "==", userId),
    where("promotion_id", "==", promoId),
  );
  const snap = await getDocs(q);
  const now = Date.now();

  const active = snap.docs
    .map((d) => d.data())
    .find((d) => d.used === false && d.expiresAt.toDate().getTime() > now);

  return active ? (active.code as string) : null;
};

const generateValidationCode = async (userId: string, promoId: string, busId: string) => {
  // Evita que un código aleatorio repetido sobrescriba el de otro usuario
  let generatedCode = "";
  do {
    generatedCode = String(Math.floor(1000 + Math.random() * 9000));
  } while ((await getDoc(doc(db, "validationCodes", generatedCode))).exists());

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);

  await setDoc(doc(db, "validationCodes", generatedCode), {
    code: generatedCode,
    user_id: userId,
    promotion_id: promoId,
    business_id: busId,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    used: false,
  });

  return generatedCode;
};

const getOrCreateCode = async (userId: string, promoId: string, busId: string) => {
  const existing = await findActiveCode(userId, promoId);
  if (existing) return existing;
  return generateValidationCode(userId, promoId, busId);
};

  useEffect(() => {
  if (initialized.current) return;

  const init = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !promotionId || !businessId) {
      setLoadingCode(false);
      return;
    }
    initialized.current = true;
    try {
      setCode(await getOrCreateCode(uid, promotionId, businessId));
    } catch (error) {
      Alert.alert("Error", "No se pudo obtener el código. Intenta de nuevo.");
    } finally {
      setLoadingCode(false);
    }
  };
  init();
}, []);

  useEffect(() => {
    if (!code) return;

    const interval = setInterval(async () => {
      try {
        const codeSnap = await getDoc(doc(db, "validationCodes", code));
        if (codeSnap.exists() && codeSnap.data().used === true) {
          clearInterval(interval);
          router.dismissAll();
          router.replace(`/customer_promotions/completed?promotion-id=${promotionId}`);
        }
      } catch (error) {
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [code]);

  return (
    <SafeAreaView style={globalStyles.mainContainer}>
      <View style={globalStyles.secondContainer}>
        <Image
          source={chip_icon}
          style={{ width: 120, height: 120, alignSelf: "center", marginTop: 50 }}
        />
        <Text style={styles.text}>
          Muéstrale este código al encargado del negocio para obtener tu ficha.
        </Text>

        <View style={{ ...globalStyles.card, alignItems: "center", marginTop: 40 }}>
          <Text style={{ color: colors.regularText, fontSize: 16 }}>Código</Text>
          <Text style={styles.codeText}>
            {loadingCode ? "..." : code}
          </Text>
          <Text style={styles.infoText}>
            Al conseguir esta ficha se hará válida la promoción.
          </Text>
        </View>

        <TouchableOpacity
          style={{ ...globalStyles.button, backgroundColor: colors.promotion, height: 50 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "bold" }}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.text}>Este código será válido durante 5 minutos.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    color: colors.regularText,
    alignSelf: "center",
    marginTop: 20,
    width: "80%",
    textAlign: "justify",
  },
  codeText: {
    color: colors.regularText,
    fontSize: 42,
    fontWeight: "500",
    marginTop: 20,
  },
  infoText: {
    color: colors.promotion,
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
});