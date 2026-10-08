"""CSV-backed API for synthetic sales signals by pharmacy sector."""

from __future__ import annotations

import base64
import csv
import json
import math
import os
import re
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

try:
    from .bedrock_summary import summarize_recommendations
    from .recommendations import build_recommendations
except ImportError:
    from bedrock_summary import summarize_recommendations
    from recommendations import build_recommendations


APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent
CSV_CONFIG = {
    "pharmacies": ("PHARMACIES_CSV", "farmacias.csv"),
    "products": ("PRODUCTS_CSV", "productos.csv"),
    "sales": ("SALES_CSV", "ventas.csv"),
    "inventory": ("INVENTORY_CSV", "inventario.csv"),
}
FIELD_ALIASES = {
    "pharmacy_id": ("id_farmacia", "pharmacy_id", "branch_id", "id_sucursal"),
    "pharmacy_name": ("nombre", "name", "nombre_farmacia", "branch_name"),
    "sector": ("ubicacion_sector", "sector", "sector_id", "id_sector"),
    "latitude": ("lat", "latitude", "latitud"),
    "longitude": ("lng", "lon", "longitude", "longitud"),
    "product_id": ("id_producto", "product_id", "sku"),
    "product_name": ("nombre", "name", "nombre_producto", "product_name"),
    "category": ("categoria", "category", "grupo"),
    "sale_id": ("id_venta", "sale_id", "id_transaccion"),
    "sale_date": ("fecha", "sale_date", "fecha_venta", "date"),
    "quantity": ("cantidad", "quantity", "unidades_vendidas", "units_sold"),
    "inventory_id": ("id_inventario", "inventory_id"),
    "stock_actual": ("stock_actual", "current_stock", "stock"),
    "stock_minimum": ("stock_minimo", "minimum_stock", "min_stock"),
    "days_coverage": ("dias_cobertura", "days_coverage", "coverage_days"),
    "stock_status": ("estado_stock", "stock_status", "status"),
    "expiration_date": ("fecha_caducidad", "expiration_date", "expiry_date"),
}
RECENT_DAYS = 30
BASELINE_DAYS = 90
MIN_RECENT_TRANSACTIONS = 2
MIN_BASELINE_TRANSACTIONS = 3
ALERT_RATIO = 1.5
STOCK_RISK_STATUSES = {"Agotado", "Bajo", "Crítico"}
STOCK_STATUSES = {
    "agotado": "Agotado",
    "bajo": "Bajo",
    "critico": "Crítico",
    "normal": "Normal",
    "excedente": "Excedente",
}


class DatasetUnavailable(Exception):
    def __init__(self, missing: list[str]):
        self.missing = missing


class DatasetInvalid(Exception):
    pass


class CategoryNotFound(Exception):
    pass


class ProductNotFound(Exception):
    pass


def _normalize_header(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-zA-Z0-9]+", "_", text.strip().lower()).strip("_")


def _data_dir() -> Path:
    configured = os.environ.get("DATA_DIR")
    if configured:
        path = Path(configured)
        return path if path.is_absolute() else PROJECT_DIR / path
    return PROJECT_DIR / "data"


def _configured_file(data_dir: Path, kind: str) -> Path:
    env_name, default_name = CSV_CONFIG[kind]
    filename = os.environ.get(env_name, default_name).strip()
    if not filename or Path(filename).name != filename:
        raise DatasetInvalid(f"{env_name} debe contener solo el nombre de un archivo CSV.")
    return data_dir / filename


def _read_csv(path: Path) -> list[dict[str, str]]:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source)
            if not reader.fieldnames:
                raise DatasetInvalid(f"{path.name}: falta la fila de encabezados.")
            rows: list[dict[str, str]] = []
            for line_number, raw in enumerate(reader, start=2):
                if None in raw:
                    raise DatasetInvalid(f"{path.name}, fila {line_number}: hay más valores que columnas.")
                row = {
                    _normalize_header(key): str(value or "").strip()
                    for key, value in raw.items()
                    if key is not None
                }
                if any(row.values()):
                    rows.append(row)
            return rows
    except UnicodeDecodeError as error:
        raise DatasetInvalid(f"{path.name}: el archivo debe usar UTF-8.") from error
    except csv.Error as error:
        raise DatasetInvalid(f"{path.name}: CSV inválido ({error}).") from error
    except OSError as error:
        raise DatasetInvalid(f"No se pudo leer {path.name}: {error.strerror or 'error de archivo'}.") from error


def _value(
    row: dict[str, str], field: str, filename: str, row_number: int, *, optional: bool = False
) -> str | None:
    for alias in FIELD_ALIASES[field]:
        value = row.get(alias, "").strip()
        if value:
            return value
    if optional:
        return None
    aliases = ", ".join(FIELD_ALIASES[field])
    raise DatasetInvalid(f"{filename}, fila {row_number}: falta {field} (encabezados aceptados: {aliases}).")


def _number(
    value: str | None, filename: str, row_number: int, field: str, *, optional: bool = False,
    minimum: float = 0,
) -> float | None:
    if value is None or value == "":
        if optional:
            return None
        raise DatasetInvalid(f"{filename}, fila {row_number}: falta el valor {field}.")
    token = value.strip()
    # The supplied CSV uses quoted decimal-comma values (for example, -0,091653).
    # Thousands separators are intentionally unsupported to avoid ambiguous input.
    if "," in token and "." in token:
        raise DatasetInvalid(f"{filename}, fila {row_number}: {field} no debe incluir separadores de miles.")
    if token.count(",") > 1:
        raise DatasetInvalid(f"{filename}, fila {row_number}: {field} tiene un formato numérico inválido.")
    try:
        parsed = float(token.replace(",", "."))
    except ValueError as error:
        raise DatasetInvalid(f"{filename}, fila {row_number}: {field} debe ser numérico.") from error
    if not math.isfinite(parsed) or parsed < minimum:
        raise DatasetInvalid(f"{filename}, fila {row_number}: {field} debe ser finito y mayor o igual a {minimum}.")
    return parsed


def _parse_date(
    value: str | None, filename: str, row_number: int, field: str = "fecha de venta"
) -> date:
    if not value:
        raise DatasetInvalid(f"{filename}, fila {row_number}: falta {field}.")
    try:
        return date.fromisoformat(value[:10])
    except ValueError as error:
        raise DatasetInvalid(f"{filename}, fila {row_number}: {field} debe usar formato AAAA-MM-DD.") from error


def _load_dataset() -> dict[str, Any]:
    data_dir = _data_dir()
    paths = {kind: _configured_file(data_dir, kind) for kind in CSV_CONFIG}
    missing = [path.name for path in paths.values() if not path.is_file()]
    if missing:
        raise DatasetUnavailable(missing)

    tables = {kind: _read_csv(path) for kind, path in paths.items()}
    if any(not rows for rows in tables.values()):
        empty = [paths[kind].name for kind, rows in tables.items() if not rows]
        raise DatasetInvalid(f"CSV sin registros: {', '.join(empty)}.")

    pharmacies: dict[str, dict[str, Any]] = {}
    for line_number, row in enumerate(tables["pharmacies"], start=2):
        filename = paths["pharmacies"].name
        pharmacy_id = _value(row, "pharmacy_id", filename, line_number)
        if pharmacy_id in pharmacies:
            raise DatasetInvalid(f"{filename}, fila {line_number}: id_farmacia duplicado ({pharmacy_id}).")
        latitude = _number(_value(row, "latitude", filename, line_number), filename, line_number, "latitud", minimum=-90)
        longitude = _number(_value(row, "longitude", filename, line_number), filename, line_number, "longitud", minimum=-180)
        if latitude is None or not -90 <= latitude <= 90:
            raise DatasetInvalid(f"{filename}, fila {line_number}: latitud fuera del rango -90 a 90.")
        if longitude is None or not -180 <= longitude <= 180:
            raise DatasetInvalid(f"{filename}, fila {line_number}: longitud fuera del rango -180 a 180.")
        pharmacies[pharmacy_id] = {
            "id": pharmacy_id,
            "name": _value(row, "pharmacy_name", filename, line_number),
            "sectorId": _value(row, "sector", filename, line_number, optional=True) or "sin-sector",
            "lat": latitude,
            "lng": longitude,
        }

    products: dict[str, dict[str, Any]] = {}
    for line_number, row in enumerate(tables["products"], start=2):
        filename = paths["products"].name
        product_id = _value(row, "product_id", filename, line_number)
        if product_id in products:
            raise DatasetInvalid(f"{filename}, fila {line_number}: id_producto duplicado ({product_id}).")
        products[product_id] = {
            "id": product_id,
            "name": _value(row, "product_name", filename, line_number),
            "category": _value(row, "category", filename, line_number, optional=True) or "Sin categoría",
        }

    sales: list[dict[str, Any]] = []
    sale_ids: set[str] = set()
    for line_number, row in enumerate(tables["sales"], start=2):
        filename = paths["sales"].name
        pharmacy_id = _value(row, "pharmacy_id", filename, line_number)
        product_id = _value(row, "product_id", filename, line_number)
        if pharmacy_id not in pharmacies or product_id not in products:
            raise DatasetInvalid(f"{filename}, fila {line_number}: farmacia o producto no existe en sus CSV de referencia.")
        sale_id = _value(row, "sale_id", filename, line_number, optional=True)
        if sale_id and sale_id in sale_ids:
            raise DatasetInvalid(f"{filename}, fila {line_number}: id_venta duplicado ({sale_id}).")
        if sale_id:
            sale_ids.add(sale_id)
        sales.append({
            "date": _parse_date(_value(row, "sale_date", filename, line_number), filename, line_number),
            "pharmacyId": pharmacy_id,
            "productId": product_id,
            "quantity": _number(_value(row, "quantity", filename, line_number), filename, line_number, "cantidad") or 0.0,
        })

    inventory: list[dict[str, Any]] = []
    inventory_keys: set[tuple[str, str]] = set()
    for line_number, row in enumerate(tables["inventory"], start=2):
        filename = paths["inventory"].name
        pharmacy_id = _value(row, "pharmacy_id", filename, line_number)
        product_id = _value(row, "product_id", filename, line_number)
        if pharmacy_id not in pharmacies or product_id not in products:
            raise DatasetInvalid(f"{filename}, fila {line_number}: farmacia o producto no existe en sus CSV de referencia.")
        key = (pharmacy_id, product_id)
        if key in inventory_keys:
            raise DatasetInvalid(f"{filename}, fila {line_number}: hay más de un registro para la farmacia/producto {pharmacy_id}/{product_id}.")
        inventory_keys.add(key)

        raw_status = _value(row, "stock_status", filename, line_number)
        normalized_status = _normalize_header(raw_status)
        if normalized_status not in STOCK_STATUSES:
            allowed = ", ".join(STOCK_STATUSES.values())
            raise DatasetInvalid(f"{filename}, fila {line_number}: estado de inventario inválido ({raw_status}); usa {allowed}.")

        raw_expiration = _value(row, "expiration_date", filename, line_number, optional=True)
        if raw_expiration:
            _parse_date(raw_expiration, filename, line_number, "fecha de caducidad")
        product = products[product_id]
        inventory.append({
            "id": _value(row, "inventory_id", filename, line_number, optional=True),
            "pharmacyId": pharmacy_id,
            "productId": product_id,
            "productName": product["name"],
            "category": product["category"],
            "stockActual": _number(_value(row, "stock_actual", filename, line_number), filename, line_number, "stock_actual"),
            "stockMinimum": _number(_value(row, "stock_minimum", filename, line_number), filename, line_number, "stock_minimo"),
            "daysCoverage": _number(_value(row, "days_coverage", filename, line_number), filename, line_number, "dias_cobertura"),
            "status": STOCK_STATUSES[normalized_status],
            "expirationDate": raw_expiration,
        })

    return {"pharmacies": pharmacies, "products": products, "sales": sales, "inventory": inventory}


def _dashboard(
    dataset: dict[str, Any], category_filter: str | None = None, product_filter: str | None = None
) -> dict[str, Any]:
    pharmacies = dataset["pharmacies"]
    products = dataset["products"]
    sales = dataset["sales"]
    inventory = dataset["inventory"]
    categories = sorted({product["category"] for product in products.values()}, key=str.casefold)
    if category_filter and category_filter not in categories:
        raise CategoryNotFound(category_filter)
    if product_filter and product_filter not in products:
        raise ProductNotFound(product_filter)
    if product_filter and category_filter and products[product_filter]["category"] != category_filter:
        raise ProductNotFound(product_filter)
    product_rows = sorted(products.values(), key=lambda product: (product["name"].casefold(), product["id"]))

    as_of = max(sale["date"] for sale in sales)
    recent_start = as_of - timedelta(days=RECENT_DAYS - 1)
    baseline_end = recent_start - timedelta(days=1)
    baseline_start = baseline_end - timedelta(days=BASELINE_DAYS - 1)

    # Each cell compares one sector/category's last 30 days with the previous 90 days.
    metrics: dict[tuple[str, str], dict[str, float]] = defaultdict(
        lambda: {"recentUnits": 0.0, "baselineUnits": 0.0, "recentTransactions": 0, "baselineTransactions": 0}
    )
    pharmacy_category_metrics: dict[tuple[str, str, str], dict[str, float]] = defaultdict(
        lambda: {"recentUnits": 0.0, "baselineUnits": 0.0}
    )
    branch_recent: dict[str, float] = defaultdict(float)
    product_recent: dict[tuple[str, str, str], float] = defaultdict(float)
    sector_totals: dict[str, dict[str, float]] = defaultdict(
        lambda: {"recentUnits": 0.0, "baselineUnits": 0.0}
    )
    for sale in sales:
        pharmacy = pharmacies[sale["pharmacyId"]]
        product = products[sale["productId"]]
        category = product["category"]
        if (category_filter and category != category_filter) or (product_filter and sale["productId"] != product_filter):
            continue
        quantity = sale["quantity"]
        key = (pharmacy["sectorId"], category)
        values = metrics[key]
        if recent_start <= sale["date"] <= as_of:
            values["recentUnits"] += quantity
            values["recentTransactions"] += 1
            pharmacy_key = (pharmacy["sectorId"], category, sale["pharmacyId"])
            pharmacy_category_metrics[pharmacy_key]["recentUnits"] += quantity
            branch_recent[sale["pharmacyId"]] += quantity
            product_recent[(pharmacy["sectorId"], category, sale["productId"])] += quantity
            sector_totals[pharmacy["sectorId"]]["recentUnits"] += quantity
        elif baseline_start <= sale["date"] <= baseline_end:
            values["baselineUnits"] += quantity
            values["baselineTransactions"] += 1
            pharmacy_key = (pharmacy["sectorId"], category, sale["pharmacyId"])
            pharmacy_category_metrics[pharmacy_key]["baselineUnits"] += quantity
            sector_totals[pharmacy["sectorId"]]["baselineUnits"] += quantity

    alerts: list[dict[str, Any]] = []
    status_by_sector: dict[str, str] = {}
    for (sector_id, category), values in metrics.items():
        baseline_units = values["baselineUnits"]
        if (
            values["baselineTransactions"] < MIN_BASELINE_TRANSACTIONS
            or values["recentTransactions"] < MIN_RECENT_TRANSACTIONS
            or baseline_units <= 0
        ):
            continue
        expected_daily = baseline_units / BASELINE_DAYS
        observed_daily = values["recentUnits"] / RECENT_DAYS
        ratio = observed_daily / expected_daily if expected_daily else 0
        if ratio < ALERT_RATIO:
            continue
        change_percent = (ratio - 1) * 100
        severity = "red" if ratio >= 2 else "yellow"
        status_by_sector[sector_id] = (
            "red" if severity == "red" or status_by_sector.get(sector_id) == "red" else "yellow"
        )
        top_products = [
            {"id": product_id, "name": products[product_id]["name"], "units": units}
            for (candidate_sector, candidate_category, product_id), units in product_recent.items()
            if candidate_sector == sector_id and candidate_category == category
        ]
        top_products.sort(key=lambda product: (-product["units"], product["name"].casefold()))
        lead_candidates = []
        for (candidate_sector, candidate_category, pharmacy_id), pharmacy_values in pharmacy_category_metrics.items():
            if candidate_sector != sector_id or candidate_category != category or pharmacy_values["recentUnits"] <= 0:
                continue
            pharmacy = pharmacies[pharmacy_id]
            expected_units = pharmacy_values["baselineUnits"] * RECENT_DAYS / BASELINE_DAYS
            excess_units = pharmacy_values["recentUnits"] - expected_units
            lead_candidates.append((
                excess_units,
                pharmacy_values["recentUnits"],
                pharmacy,
                pharmacy_values,
                expected_units,
            ))
        lead_candidates.sort(key=lambda candidate: (-candidate[0], -candidate[1], candidate[2]["name"].casefold()))
        lead_pharmacy = None
        if lead_candidates:
            excess_units, _, pharmacy, pharmacy_values, expected_units = lead_candidates[0]
            lead_pharmacy = {
                "id": pharmacy["id"],
                "name": pharmacy["name"],
                "sectorId": pharmacy["sectorId"],
                "lat": pharmacy["lat"],
                "lng": pharmacy["lng"],
                "recentUnits": round(pharmacy_values["recentUnits"], 2),
                "baselineUnits": round(pharmacy_values["baselineUnits"], 2),
                "expectedUnits": round(expected_units, 2),
                "excessUnits": round(excess_units, 2),
            }
        alerts.append({
            "id": f"{sector_id}:{category}",
            "sectorId": sector_id,
            "sector": sector_id,
            "category": category,
            "status": severity,
            "recentUnits": round(values["recentUnits"], 2),
            "baselineUnits": round(baseline_units, 2),
            "recentTransactions": values["recentTransactions"],
            "baselineTransactions": values["baselineTransactions"],
            "observedDailyUnits": round(observed_daily, 3),
            "expectedDailyUnits": round(expected_daily, 3),
            "changePercent": round(change_percent, 1),
            "topProducts": top_products[:3],
            "leadPharmacy": lead_pharmacy,
        })
    alerts.sort(key=lambda alert: (-alert["changePercent"], -alert["recentUnits"], alert["sector"], alert["category"]))

    inventory_by_pharmacy: dict[str, list[dict[str, Any]]] = defaultdict(list)
    inventory_by_sector: dict[str, dict[str, Any]] = {}
    for item in inventory:
        if (category_filter and item["category"] != category_filter) or (product_filter and item["productId"] != product_filter):
            continue
        pharmacy = pharmacies[item["pharmacyId"]]
        inventory_by_pharmacy[item["pharmacyId"]].append(item)
        sector_id = pharmacy["sectorId"]
        summary = inventory_by_sector.setdefault(sector_id, {
            "sectorId": sector_id,
            "recordCount": 0,
            "riskCount": 0,
            "criticalCount": 0,
            "lowCount": 0,
            "outOfStockCount": 0,
            "coverageTotal": 0.0,
            "pharmaciesAtRisk": set(),
        })
        summary["recordCount"] += 1
        summary["coverageTotal"] += item["daysCoverage"]
        if item["status"] in STOCK_RISK_STATUSES:
            summary["riskCount"] += 1
            summary["pharmaciesAtRisk"].add(item["pharmacyId"])
        if item["status"] == "Crítico":
            summary["criticalCount"] += 1
        elif item["status"] == "Bajo":
            summary["lowCount"] += 1
        elif item["status"] == "Agotado":
            summary["outOfStockCount"] += 1

    inventory_sector_rows = []
    for summary in inventory_by_sector.values():
        records = summary["recordCount"]
        inventory_sector_rows.append({
            "sectorId": summary["sectorId"],
            "recordCount": records,
            "riskCount": summary["riskCount"],
            "criticalCount": summary["criticalCount"],
            "lowCount": summary["lowCount"],
            "outOfStockCount": summary["outOfStockCount"],
            "pharmaciesAtRisk": len(summary["pharmaciesAtRisk"]),
            "riskPercent": round(summary["riskCount"] / records * 100, 1) if records else 0.0,
            "averageCoverageDays": round(summary["coverageTotal"] / records, 1) if records else 0.0,
        })
    inventory_sector_rows.sort(key=lambda row: (-row["riskPercent"], -row["riskCount"], row["sectorId"].casefold()))

    inventory_alerts = [
        {
            **item,
            "pharmacyName": pharmacies[item["pharmacyId"]]["name"],
            "sectorId": pharmacies[item["pharmacyId"]]["sectorId"],
        }
        for item in inventory
        if ((not category_filter or item["category"] == category_filter)
            and (not product_filter or item["productId"] == product_filter)
            and item["status"] in STOCK_RISK_STATUSES)
    ]
    inventory_alerts.sort(key=lambda item: (
        {"Agotado": 0, "Crítico": 1, "Bajo": 2}.get(item["status"], 3),
        item["daysCoverage"],
        item["sectorId"].casefold(),
        item["productName"].casefold(),
    ))

    pharmacy_rows = []
    for pharmacy in pharmacies.values():
        pharmacy_inventory = sorted(
            inventory_by_pharmacy.get(pharmacy["id"], []),
            key=lambda item: (item["daysCoverage"], item["productName"].casefold()),
        )
        inventory_count = len(pharmacy_inventory)
        risk_count = sum(item["status"] in STOCK_RISK_STATUSES for item in pharmacy_inventory)
        pharmacy_rows.append({
            **pharmacy,
            "recentUnits": round(branch_recent.get(pharmacy["id"], 0.0), 2),
            "status": status_by_sector.get(pharmacy["sectorId"], "green"),
            "inventory": pharmacy_inventory,
            "inventorySummary": {
                "recordCount": inventory_count,
                "riskCount": risk_count,
                "riskPercent": round(risk_count / inventory_count * 100, 1) if inventory_count else 0.0,
                "averageCoverageDays": round(
                    sum(item["daysCoverage"] for item in pharmacy_inventory) / inventory_count, 1
                ) if inventory_count else None,
            },
        })
    pharmacy_rows.sort(key=lambda pharmacy: pharmacy["name"].casefold())
    pharmacies_by_id = {pharmacy["id"]: pharmacy for pharmacy in pharmacy_rows}
    for alert in alerts:
        lead_pharmacy = alert["leadPharmacy"]
        if lead_pharmacy:
            lead_pharmacy["inventorySummary"] = pharmacies_by_id[lead_pharmacy["id"]]["inventorySummary"]

    sector_metric_rows = []
    for sector_id, values in sector_totals.items():
        baseline_units = values["baselineUnits"]
        change_percent = ((values["recentUnits"] / RECENT_DAYS) / (baseline_units / BASELINE_DAYS) - 1) * 100 if baseline_units else None
        sector_metric_rows.append({
            "sectorId": sector_id,
            "recentUnits": round(values["recentUnits"], 2),
            "baselineUnits": round(baseline_units, 2),
            "changePercent": round(change_percent, 1) if change_percent is not None else None,
        })
    sector_metric_rows.sort(key=lambda row: row["sectorId"].casefold())

    recent_units = sum(branch_recent.values())
    stats = {
        "totalPharmacies": len(pharmacies),
        "totalSectors": len({pharmacy["sectorId"] for pharmacy in pharmacies.values()}),
        "sectorsWithSignals": len(status_by_sector),
        "highSignalCount": sum(alert["status"] == "red" for alert in alerts),
        "watchSignalCount": sum(alert["status"] == "yellow" for alert in alerts),
        "alertCount": len(alerts),
        "recentUnits": round(recent_units, 2),
        "inventoryRecordCount": sum(row["recordCount"] for row in inventory_sector_rows),
        "inventoryRiskCount": sum(row["riskCount"] for row in inventory_sector_rows),
        "inventoryCriticalCount": sum(row["criticalCount"] for row in inventory_sector_rows),
        "inventoryLowCount": sum(row["lowCount"] for row in inventory_sector_rows),
        "inventoryOutOfStockCount": sum(row["outOfStockCount"] for row in inventory_sector_rows),
    }
    return {
        "dataStatus": "synthetic",
        "asOf": as_of.isoformat(),
        "periods": {
            "recentStart": recent_start.isoformat(),
            "recentEnd": as_of.isoformat(),
            "baselineStart": baseline_start.isoformat(),
            "baselineEnd": baseline_end.isoformat(),
        },
        "method": {
            "type": "sector-category-sales-anomaly",
            "thresholdPercent": (ALERT_RATIO - 1) * 100,
            "minimumRecentTransactions": MIN_RECENT_TRANSACTIONS,
            "minimumBaselineTransactions": MIN_BASELINE_TRANSACTIONS,
            "description": "Compara unidades vendidas en 30 días con el promedio diario de los 90 días anteriores.",
        },
        "categories": categories,
        "products": product_rows,
        "selectedCategory": category_filter or "all",
        "selectedProduct": product_filter or "all",
        "pharmacies": pharmacy_rows,
        "alerts": alerts,
        "sectorMetrics": sector_metric_rows,
        "inventorySectors": inventory_sector_rows,
        "inventoryAlerts": inventory_alerts[:100],
        "stats": stats,
    }


def _error(status: int, code: str, message: str, **details: Any) -> tuple[int, dict[str, Any] | None]:
    return status, {"error": {"code": code, "message": message, **details}}


def handle_api(
    method: str, path: str, query: dict[str, Any] | None = None
) -> tuple[int, dict[str, Any] | None]:
    query = query or {}
    if method == "OPTIONS":
        return 204, None
    if method == "GET" and path == "/health":
        return 200, {"status": "ok", "service": "farmasenal-backend"}
    if method == "GET" and path == "/api/v1/dashboard":
        try:
            dataset = _load_dataset()
            category = query.get("category")
            product_id = query.get("product_id")
            return 200, _dashboard(
                dataset,
                str(category) if category else None,
                str(product_id) if product_id else None,
            )
        except DatasetUnavailable as error:
            return _error(503, "DATA_NOT_READY", "Faltan CSV requeridos en data/.", missingFiles=error.missing)
        except DatasetInvalid as error:
            return _error(422, "DATA_INVALID", str(error))
        except CategoryNotFound as error:
            return _error(404, "CATEGORY_NOT_FOUND", "La categoría solicitada no existe en los CSV.", category=str(error))
        except ProductNotFound as error:
            return _error(404, "PRODUCT_NOT_FOUND", "El producto solicitado no existe o no pertenece a la categoría seleccionada.", productId=str(error))
    if path == "/api/v1/recommendations" and method == "GET":
        try:
            return 200, build_recommendations(_load_dataset())
        except DatasetUnavailable as error:
            return _error(503, "DATA_NOT_READY", "Faltan CSV requeridos en data/.", missingFiles=error.missing)
        except DatasetInvalid as error:
            return _error(422, "DATA_INVALID", str(error))
    if path == "/api/v1/recommendations/analyze" and method == "POST":
        try:
            recommendations = build_recommendations(_load_dataset())
            return 200, {"dataStatus": "synthetic", **summarize_recommendations(recommendations)}
        except DatasetUnavailable as error:
            return _error(503, "DATA_NOT_READY", "Faltan CSV requeridos en data/.", missingFiles=error.missing)
        except DatasetInvalid as error:
            return _error(422, "DATA_INVALID", str(error))
    if path in ("/api/v1/recommendations", "/api/v1/recommendations/analyze"):
        return _error(405, "METHOD_NOT_ALLOWED", "Método HTTP no permitido.")
    if path.startswith("/api/") and method not in ("GET", "OPTIONS"):
        return _error(405, "METHOD_NOT_ALLOWED", "Método HTTP no permitido.")
    return _error(404, "NOT_FOUND", "Ruta no encontrada.")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    http_context = event.get("requestContext", {}).get("http", {})
    method = event.get("httpMethod") or http_context.get("method", "GET")
    path = event.get("rawPath") or event.get("path", "/")
    query = event.get("queryStringParameters") or {}
    status, payload = handle_api(method, path, query)

    allowed_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
    headers_in = {str(key).lower(): value for key, value in (event.get("headers") or {}).items()}
    request_origin = headers_in.get("origin")
    cors_origin = allowed_origin if request_origin in (None, "", allowed_origin) else "null"
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Vary": "Origin",
        },
        "body": "" if payload is None else json.dumps(payload, ensure_ascii=False),
        "isBase64Encoded": False,
    }
