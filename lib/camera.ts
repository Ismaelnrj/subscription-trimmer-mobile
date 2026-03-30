import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

export async function requestCameraPermission() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === "granted";
}

export async function requestMediaLibraryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === "granted";
}

export async function takePhoto() {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      throw new Error("Camera permission not granted");
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      return result.assets[0];
    }
  } catch (error) {
    console.error("Error taking photo:", error);
    throw error;
  }
}

export async function pickImageFromLibrary() {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      throw new Error("Media library permission not granted");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      return result.assets[0];
    }
  } catch (error) {
    console.error("Error picking image:", error);
    throw error;
  }
}

export async function uploadReceiptImage(imageUri: string, subscriptionId: number) {
  try {
    const fileName = `receipt_${subscriptionId}_${Date.now()}.jpg`;
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Return base64 for upload
    return {
      fileName,
      base64,
      subscriptionId,
    };
  } catch (error) {
    console.error("Error processing receipt image:", error);
    throw error;
  }
}
