import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";

export const convertImageToPDF = async (imageFile, docId, fileIndex) => {
  try {
    const base64Image = await FileSystem.readAsStringAsync(imageFile.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mimeType = imageFile.mimeType || "image/jpeg";
    const base64DataUri = `data:${mimeType};base64,${base64Image}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { margin: 0; size: A4; }
          body {
            margin: 0; padding: 0;
            width: 100%; height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          img {
            max-width: 100%; max-height: 100%;
            object-fit: contain; display: block;
          }
        </style>
      </head>
      <body><img src="${base64DataUri}" /></body>
      </html>
    `;

    const { uri: pdfUri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });
    const pdfInfo = await FileSystem.getInfoAsync(pdfUri);
    const originalName = imageFile.filename || imageFile.name || "image";
    const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, "");

    return {
      filename: `${docId}.pdf`,
      uri: pdfUri,
      mimeType: "application/pdf",
      size: pdfInfo.size,
      uploadDate: new Date().toLocaleString("th-TH"),
      status: "pending",
      fileIndex: fileIndex,
      convertedFromImage: true,
      originalImageName: imageFile.filename ?? null,
      originalImageType: imageFile.mimeType ?? null,
    };
  } catch (error) {
    console.error("Error converting image to PDF:", error);
    throw new Error(`ไม่สามารถแปลงรูปภาพเป็น PDF ได้: ${error.message}`);
  }
};
