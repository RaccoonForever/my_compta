from app.domain.services import compute_tva


def test_compute_tva():
    assert compute_tva(100, 20) == 20.0
    assert compute_tva(10.5, 5.5) == 0.58
