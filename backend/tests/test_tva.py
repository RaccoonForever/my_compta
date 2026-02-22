import pytest
from app.domain.services import compute_tva, TVACalculationError


def test_compute_tva():
    """Test basic TVA calculation."""
    assert compute_tva(100, 20) == 20.0
    assert compute_tva(10.5, 5.5) == 0.58


def test_compute_tva_zero_rate():
    """Test TVA calculation with 0% rate."""
    assert compute_tva(100, 0) == 0.0


def test_compute_tva_100_rate():
    """Test TVA calculation with 100% rate."""
    assert compute_tva(100, 100) == 100.0


def test_compute_tva_invalid_amount():
    """Test TVA calculation with invalid amount."""
    with pytest.raises(TVACalculationError):
        compute_tva(-100, 20)
    
    with pytest.raises(TVACalculationError):
        compute_tva(0, 20)


def test_compute_tva_invalid_rate():
    """Test TVA calculation with invalid rate."""
    with pytest.raises(TVACalculationError):
        compute_tva(100, -10)
    
    with pytest.raises(TVACalculationError):
        compute_tva(100, 101)
