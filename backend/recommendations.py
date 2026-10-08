"""Deterministic replenishment suggestions over the synthetic demo dataset."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, timedelta
from typing import Any


RISK_STATUSES = {"Agotado", "Crítico", "Bajo"}
STATUS_ORDER = {"Agotado": 0, "Crítico": 1, "Bajo": 2}
EARTH_RADIUS_KM = 6371.0088
RECENT_DAYS = 30
BASELINE_DAYS = 90
MIN_RECENT_TRANSACTIONS = 2
MIN_BASELINE_TRANSACTIONS = 3
ALERT_RATIO = 1.5


def _coordinates(pharmacy: dict[str, Any]) -> tuple[float, float] | None:
    try:
        latitude = float(pharmacy["lat"])
        longitude = float(pharmacy["lng"])
    except (KeyError, TypeError, ValueError):
        return None
    if not math.isfinite(latitude) or not math.isfinite(longitude):
        return None
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return None
    return latitude, longitude


def _distance_km(left: tuple[float, float], right: tuple[float, float]) -> float:
    left_lat, left_lng = map(math.radians, left)
    right_lat, right_lng = map(math.radians, right)
    latitude_delta = right_lat - left_lat
    longitude_delta = right_lng - left_lng
    haversine = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(left_lat) * math.cos(right_lat) * math.sin(longitude_delta / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.asin(min(1.0, math.sqrt(haversine)))


def _expiration_date(item: dict[str, Any]) -> date | None:
    raw_value = item.get("expirationDate")
    if not raw_value:
        return None
    try:
        return date.fromisoformat(str(raw_value))
    except ValueError:
        return None


def _sales_signals(
    dataset: dict[str, Any], reference_date: date | None
) -> dict[tuple[str, str], dict[str, Any]]:
    if reference_date is None:
        return {}

    pharmacies = dataset["pharmacies"]
    products = dataset["products"]
    recent_start = reference_date - timedelta(days=RECENT_DAYS - 1)
    baseline_end = recent_start - timedelta(days=1)
    baseline_start = baseline_end - timedelta(days=BASELINE_DAYS - 1)
    metrics: dict[tuple[str, str], dict[str, float]] = defaultdict(
        lambda: {"recentUnits": 0.0, "baselineUnits": 0.0, "recentTransactions": 0, "baselineTransactions": 0}
    )

    for sale in dataset["sales"]:
        pharmacy = pharmacies[sale["pharmacyId"]]
        product = products[sale["productId"]]
        key = (pharmacy["sectorId"], product["category"])
        values = metrics[key]
        if recent_start <= sale["date"] <= reference_date:
            values["recentUnits"] += sale["quantity"]
            values["recentTransactions"] += 1
        elif baseline_start <= sale["date"] <= baseline_end:
            values["baselineUnits"] += sale["quantity"]
            values["baselineTransactions"] += 1

    signals: dict[tuple[str, str], dict[str, Any]] = {}
    for key, values in metrics.items():
        baseline_units = values["baselineUnits"]
        if (
            values["baselineTransactions"] < MIN_BASELINE_TRANSACTIONS
            or values["recentTransactions"] < MIN_RECENT_TRANSACTIONS
            or baseline_units <= 0
        ):
            continue
        recent_daily = values["recentUnits"] / RECENT_DAYS
        baseline_daily = baseline_units / BASELINE_DAYS
        ratio = recent_daily / baseline_daily if baseline_daily else 0
        if ratio < ALERT_RATIO:
            continue
        signals[key] = {
            "changePercent": round((ratio - 1) * 100, 1),
            "status": "red" if ratio >= 2 else "yellow",
            "recentUnits": round(values["recentUnits"], 2),
            "baselineUnits": round(baseline_units, 2),
        }
    return signals


def _pharmacy_summary(pharmacy: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": pharmacy["id"],
        "name": pharmacy["name"],
        "sectorId": pharmacy["sectorId"],
    }


def _priority(status: str) -> str:
    return "high" if status in {"Agotado", "Crítico"} else "medium"


def build_recommendations(dataset: dict[str, Any]) -> dict[str, Any]:
    """Return explainable transfer and watch candidates without changing input data."""

    pharmacies = dataset["pharmacies"]
    products = dataset["products"]
    inventory = dataset["inventory"]
    sales = dataset["sales"]
    reference_date = max((sale["date"] for sale in sales), default=None)
    signals = _sales_signals(dataset, reference_date)

    recipients: list[dict[str, Any]] = []
    for item in inventory:
        if item["status"] not in RISK_STATUSES or item["stockActual"] >= item["stockMinimum"]:
            continue
        pharmacy = pharmacies[item["pharmacyId"]]
        signal = signals.get((pharmacy["sectorId"], item["category"]))
        recipients.append({"item": item, "pharmacy": pharmacy, "signal": signal})

    recipients.sort(
        key=lambda candidate: (
            STATUS_ORDER[candidate["item"]["status"]],
            candidate["item"]["daysCoverage"],
            -candidate["signal"]["changePercent"] if candidate["signal"] else 0,
            candidate["pharmacy"]["name"].casefold(),
            candidate["item"]["productName"].casefold(),
        )
    )

    donors_by_product: dict[str, list[dict[str, Any]]] = defaultdict(list)
    remaining_surplus: dict[tuple[str, str], float] = {}
    for item in inventory:
        if item["status"] != "Excedente":
            continue
        pharmacy = pharmacies[item["pharmacyId"]]
        coordinates = _coordinates(pharmacy)
        expiry = _expiration_date(item)
        if coordinates is None or expiry is None or reference_date is None or expiry <= reference_date:
            continue
        available = max(0.0, item["stockActual"] - item["stockMinimum"])
        if available <= 0:
            continue
        key = (item["pharmacyId"], item["productId"])
        remaining_surplus[key] = available
        donors_by_product[item["productId"]].append({
            "item": item,
            "pharmacy": pharmacy,
            "coordinates": coordinates,
        })

    recommendations_with_order: list[tuple[tuple[Any, ...], dict[str, Any]]] = []
    for recipient in recipients:
        item = recipient["item"]
        destination = recipient["pharmacy"]
        destination_coordinates = _coordinates(destination)
        signal = recipient["signal"]
        needed = max(0.0, item["stockMinimum"] - item["stockActual"])
        remaining_need = needed
        candidates: list[tuple[float, str, dict[str, Any]]] = []

        if destination_coordinates is not None:
            for donor in donors_by_product.get(item["productId"], []):
                source = donor["pharmacy"]
                source_key = (source["id"], item["productId"])
                if source["id"] == destination["id"] or remaining_surplus.get(source_key, 0) <= 0:
                    continue
                distance = _distance_km(destination_coordinates, donor["coordinates"])
                candidates.append((distance, source["name"].casefold(), donor))
        candidates.sort(key=lambda candidate: (candidate[0], candidate[1]))

        for distance, _, donor in candidates:
            if remaining_need <= 0:
                break
            source_item = donor["item"]
            source = donor["pharmacy"]
            source_key = (source["id"], item["productId"])
            quantity = round(min(remaining_need, remaining_surplus.get(source_key, 0)), 2)
            if quantity <= 0:
                continue

            remaining_surplus[source_key] = round(remaining_surplus[source_key] - quantity, 2)
            remaining_need = round(remaining_need - quantity, 2)
            source_summary = {
                **_pharmacy_summary(source),
                "stockActual": source_item["stockActual"],
                "stockMinimum": source_item["stockMinimum"],
                "availableSurplus": remaining_surplus[source_key] + quantity,
                "expirationDate": source_item["expirationDate"],
            }
            destination_summary = {
                **_pharmacy_summary(destination),
                "stockActual": item["stockActual"],
                "stockMinimum": item["stockMinimum"],
                "daysCoverage": item["daysCoverage"],
                "status": item["status"],
            }
            evidence = [
                f"Destino {item['status'].lower()}: {item['stockActual']:g} uds. frente a un mínimo de {item['stockMinimum']:g}.",
                f"Cobertura registrada: {item['daysCoverage']:g} días.",
                f"Origen con excedente seguro: {source_item['stockActual']:g} uds. y reserva mínima de {source_item['stockMinimum']:g}.",
                f"Distancia aproximada en línea recta: {distance:.1f} km.",
            ]
            if signal:
                evidence.append(
                    f"Señal de ventas en {destination['sectorId']} para {item['category']}: +{signal['changePercent']:g}% frente a la línea base."
                )
            else:
                evidence.append(
                    f"Sin señal de ventas coincidente utilizable para {destination['sectorId']} y {item['category']} (sin aumento suficiente o historial insuficiente)."
                )
            recommendations_with_order.append((
                (
                    STATUS_ORDER[item["status"]],
                    item["daysCoverage"],
                    -signal["changePercent"] if signal else 0,
                    distance,
                    destination["name"].casefold(),
                    item["productName"].casefold(),
                ),
                {
                    "id": f"transfer:{source['id']}:{destination['id']}:{item['productId']}",
                    "type": "transfer",
                    "priority": _priority(item["status"]),
                    "product": products[item["productId"]],
                    "source": source_summary,
                    "destination": destination_summary,
                    "suggestedQuantity": quantity,
                    "distanceKm": round(distance, 1),
                    "distanceType": "straight_line_approx",
                    "salesSignal": signal,
                    "evidence": evidence,
                },
            ))

        if remaining_need > 0:
            if destination_coordinates is None:
                reason = "No se puede estimar proximidad porque faltan coordenadas válidas del destino."
            elif not candidates:
                reason = "No hay un origen elegible con excedente, caducidad futura y ubicación válida para este producto."
            else:
                reason = f"Los orígenes elegibles no cubren el faltante completo; quedan {remaining_need} uds. por resolver."
            evidence = [
                f"Destino {item['status'].lower()}: {item['stockActual']:g} uds. frente a un mínimo de {item['stockMinimum']:g}.",
                f"Cobertura registrada: {item['daysCoverage']:g} días.",
                reason,
            ]
            if signal:
                evidence.append(
                    f"Señal de ventas en {destination['sectorId']} para {item['category']}: +{signal['changePercent']:g}% frente a la línea base."
                )
            else:
                evidence.append(
                    f"Sin señal de ventas coincidente utilizable para {destination['sectorId']} y {item['category']} (sin aumento suficiente o historial insuficiente)."
                )
            recommendations_with_order.append((
                (
                    STATUS_ORDER[item["status"]],
                    item["daysCoverage"],
                    -signal["changePercent"] if signal else 0,
                    math.inf,
                    destination["name"].casefold(),
                    item["productName"].casefold(),
                ),
                {
                    "id": f"watch:{destination['id']}:{item['productId']}",
                    "type": "watch",
                    "priority": _priority(item["status"]),
                    "product": products[item["productId"]],
                    "source": None,
                    "destination": {
                        **_pharmacy_summary(destination),
                        "stockActual": item["stockActual"],
                        "stockMinimum": item["stockMinimum"],
                        "daysCoverage": item["daysCoverage"],
                        "status": item["status"],
                    },
                    "suggestedQuantity": 0,
                    "unfilledQuantity": remaining_need,
                    "distanceKm": None,
                    "distanceType": "straight_line_approx",
                    "salesSignal": signal,
                    "reason": reason,
                    "evidence": evidence,
                },
            ))

    recommendations_with_order.sort(key=lambda candidate: candidate[0])
    recommendations = [recommendation for _, recommendation in recommendations_with_order]
    transfer_count = sum(recommendation["type"] == "transfer" for recommendation in recommendations)
    watch_count = sum(recommendation["type"] == "watch" for recommendation in recommendations)
    return {
        "dataStatus": "synthetic",
        "referenceDate": reference_date.isoformat() if reference_date else None,
        "counts": {
            "transferCount": transfer_count,
            "watchCount": watch_count,
            "highPriorityCount": sum(recommendation["priority"] == "high" for recommendation in recommendations),
            "unfilledUnits": round(sum(recommendation.get("unfilledQuantity", 0) for recommendation in recommendations), 2),
        },
        "recommendations": recommendations,
    }
