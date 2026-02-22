from decimal import Decimal, ROUND_HALF_UP


class TVACalculationError(Exception):
    """Exception raised when TVA calculation fails."""
    pass


def compute_tva(amount: float, rate: float) -> float:
    """Compute TVA (VAT) for given amount and rate (percentage).

    Args:
        amount: Transaction amount (must be positive)
        rate: TVA rate as percentage (0-100)

    Returns:
        TVA amount as float with 2 decimal places using half-up rounding.

    Raises:
        TVACalculationError: If amount or rate are invalid.
    """
    if amount <= 0:
        raise TVACalculationError(f"Amount must be positive, got {amount}")
    if not (0 <= rate <= 100):
        raise TVACalculationError(f"TVA rate must be between 0 and 100, got {rate}")

    try:
        a = Decimal(str(amount))
        r = Decimal(str(rate)) / Decimal("100")
        t = (a * r).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return float(t)
    except (ValueError, TypeError) as e:
        raise TVACalculationError(f"Invalid input for TVA calculation: {str(e)}")
