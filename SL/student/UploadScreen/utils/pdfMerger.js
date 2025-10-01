import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";

// ฟังก์ชันสำหรับรวมรูปภาพหลายไฟล์ให้เป็น PDF ไฟล์เดียว
export const mergeImagesToPdf = async (
  imageFiles,
  docId,
  setIsConvertingToPDF
) => {
  if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
    throw new Error("ไม่มีไฟล์รูปภาพให้รวม");
  }

  try {
    // mark ว่ากำลังประมวลผล
    setIsConvertingToPDF((prev) => ({
      ...prev,
      [`${docId}_merge`]: true,
    }));

    // อ่านไฟล์รูปภาพเป็น base64
    const filesWithBase64 = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const base64Content = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return { ...file, base64Content };
        } catch (error) {
          console.error(
            `Error reading file ${file.name || file.filename}:`,
            error
          );
          throw new Error(
            `ไม่สามารถอ่านไฟล์ ${file.name || file.filename} ได้: ${
              error.message
            }`
          );
        }
      })
    );

    const combinedHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              @page {
                margin: 0;
                size: A4;
              }
              body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
              }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                display: block;
                page-break-after: always;
              }
              img:last-of-type {
                page-break-after: never;
              }
          </style>
      </head>
      <body>
          ${filesWithBase64
            .map((file) => {
              return `<img src="data:${file.mimeType || "image/jpeg"};base64,${
                file.base64Content
              }" />`;
            })
            .join("")}
      </body>
      </html>
    `;

    const { uri: pdfUri } = await Print.printToFileAsync({
      html: combinedHtmlContent,
      base64: false,
    });

    const pdfInfo = await FileSystem.getInfoAsync(pdfUri);

    const mergedPdfFile = {
      filename: `${docId}.pdf`,
      uri: pdfUri,
      mimeType: "application/pdf",
      size: pdfInfo.size,
      uploadDate: new Date().toLocaleString("th-TH"),
      status: "pending",
      ocrValidated: true,
      convertedFromImage: true,
      originalImageNames: imageFiles.map(
        (file) => (file.filename || file.name) ?? null
      ),
    };

    return mergedPdfFile;
  } catch (error) {
    console.error("Error in mergeImagesToPdf:", error);
    throw new Error(`ไม่สามารถรวมรูปภาพเป็น PDF ได้: ${error.message}`);
  } finally {
    // ✅ clear state เสมอ
    setIsConvertingToPDF((prev) => {
      const newState = { ...prev };
      delete newState[`${docId}_merge`];
      return newState;
    });
  }
};
