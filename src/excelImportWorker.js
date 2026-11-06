import * as XLSX from "xlsx";

const MAX_PAGES = 1000;

self.onmessage = ({ data }) => {
  try {
    const workbook = XLSX.read(data, { type: "array", sheetRows: MAX_PAGES + 2 });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("The workbook does not contain a worksheet.");

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    const firstRow = (rows[0] || []).map((cell) => String(cell ?? "").trim().toLowerCase());
    const hasHeader = /page\s*(number|no\.?)/i.test(firstRow[0] || "") &&
      /(original|english)/i.test(firstRow[1] || "") &&
      /(khmer|ភាសាខ្មែរ)/i.test(firstRow[2] || "");
    const dataRows = rows.slice(hasHeader ? 1 : 0)
      .filter((row) => [0, 1, 2].some((column) => String(row[column] ?? "").trim() !== ""));

    if (dataRows.length > MAX_PAGES) {
      throw new Error(`This sheet has more than ${MAX_PAGES} page rows. Split it into smaller workbooks.`);
    }
    if (!dataRows.length) {
      throw new Error("No page rows found. Use columns A–C for page number, English, and Khmer text.");
    }
    self.postMessage({ rows: dataRows });
  } catch (error) {
    self.postMessage({ error: error.message || "Could not read this workbook." });
  }
};
