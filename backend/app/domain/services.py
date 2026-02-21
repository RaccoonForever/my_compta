from decimal import Decimal, ROUND_HALF_UP


def compute_tva(amount: float, rate: float) -> float:
    """Compute TVA (VAT) for given amount and rate (percentage).

    Returns a rounded float with 2 decimals using half-up rounding.
    """
    a = Decimal(str(amount))
    r = Decimal(str(rate)) / Decimal("100")
    t = (a * r).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(t)
