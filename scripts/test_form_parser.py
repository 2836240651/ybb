import unittest
from pathlib import Path
from openpyxl import Workbook
import form_parser as fp

class FormParserTests(unittest.TestCase):
    def write_std_sheet(self, path: Path):
        wb = Workbook()
        ws = wb.active
        ws.title = "铅坠"
        ws.append(["名称", "图片", "规格", "货号", "产品编码", "批发（美元）"])
        ws.append(["DG", None, "56g", "TZ-QZ-001", "TZ-QZ-001-56g", 0.49])
        ws.append([None, None, "71g", "TZ-QZ-001", "TZ-QZ-001-71g", 0.59])
        wb.save(path)

    def test_standard_sheet_parses_variant_skus(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            xlsx = Path(tmp) / "t.xlsx"
            self.write_std_sheet(xlsx)
            schema = fp.load_schema()
            schema["sheetMap"] = {"铅坠": schema["sheetMap"]["铅坠"]}
            rows, manifest = fp.parse_workbook(xlsx, schema=schema, sku_mappings_dir=Path(tmp)/"maps")
            skus = {r.variant_sku for r in rows}
            self.assertEqual(skus, {"TZ-QZ-001-56g", "TZ-QZ-001-71g"})
            self.assertEqual(manifest["stats"]["sellableSkuCount"], 2)

if __name__ == "__main__":
    unittest.main()
