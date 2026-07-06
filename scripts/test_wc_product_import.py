import unittest

from form_parser import (
    CatalogProduct,
    CatalogVariation,
    SellableRow,
    catalog_product_to_dict,
    catalog_stats,
    group_rows_by_parent,
)


def make_row(
    *,
    parent_sku: str,
    variant_sku: str,
    spec: str,
    price: str,
    product_type: str = "DG",
    sheet_title_en: str = "Sinkers",
    sheet: str = "铅坠",
    sheet_handle: str = "sinkers",
    row_index: int = 1,
    category_slugs: list[str] | None = None,
) -> SellableRow:
    return SellableRow(
        sheet=sheet,
        sheet_handle=sheet_handle,
        sheet_title_en=sheet_title_en,
        row_index=row_index,
        product_type_name=product_type,
        spec=spec,
        parent_sku=parent_sku,
        variant_sku=variant_sku,
        price=price,
        category_slugs=category_slugs or ["sinkers", "sinkers--dg"],
    )


class WcProductImportTests(unittest.TestCase):
    def test_groups_rows_with_same_base_sku_into_variable_product(self):
        rows = [
            make_row(
                parent_sku="TZ-QZ-001",
                variant_sku="TZ-QZ-001-56g",
                spec="56g",
                price="0.49",
                row_index=1,
            ),
            make_row(
                parent_sku="TZ-QZ-001",
                variant_sku="TZ-QZ-001-71g",
                spec="71g",
                price="0.59",
                row_index=2,
            ),
        ]

        products = group_rows_by_parent(rows)
        stats = catalog_stats(products)

        self.assertEqual(stats["productCount"], 1)
        self.assertEqual(stats["variationCount"], 2)
        product = products[0]
        self.assertEqual(product.type, "variable")
        self.assertEqual(product.parentSku, "TZ-QZ-001")
        self.assertEqual(product.name, "Sinkers - DG")
        self.assertEqual(product.categorySlugs, ["sinkers", "sinkers--dg"])
        self.assertEqual([v.sku for v in product.variations], ["TZ-QZ-001-56g", "TZ-QZ-001-71g"])
        self.assertEqual([v.spec for v in product.variations], ["56g", "71g"])

    def test_single_row_product_is_simple(self):
        rows = [
            make_row(
                parent_sku="TZ-HK-001",
                variant_sku="TZ-HK-001-4",
                spec="4#",
                price="1.25",
                product_type="Hook",
                sheet_title_en="Carp Hooks",
                sheet_handle="carp-hooks",
                category_slugs=["carp-hooks"],
            )
        ]

        product = group_rows_by_parent(rows)[0]
        payload = catalog_product_to_dict(product)

        self.assertEqual(product.type, "simple")
        self.assertEqual(payload["regularPrice"], "1.25")
        self.assertEqual(payload["spec"], "4#")
        self.assertEqual(payload["variationSku"], "TZ-HK-001-4")

    def test_catalog_product_to_dict_keeps_variations(self):
        product = CatalogProduct(
            parentSku="TZ-QZ-001",
            name="Carp Lead - DG",
            nameZh="DG",
            nameJa="Carp Lead - DG",
            type="variable",
            categorySlugs=["sinkers"],
            sheet="铅坠",
            sheetHandle="sinkers",
            variations=[
                CatalogVariation(
                    sku="TZ-QZ-001-56g",
                    spec="56g",
                    price="1.99",
                    titleZh="DG - 56g",
                    titleJa="DG - 56g",
                )
            ],
        )
        payload = catalog_product_to_dict(product)
        self.assertEqual(payload["name"], "Carp Lead - DG")
        self.assertEqual(payload["variations"][0]["price"], "1.99")


if __name__ == "__main__":
    unittest.main()
