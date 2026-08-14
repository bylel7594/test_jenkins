import pytest
from calculator import add, subtract, multiply, divide, power, is_prime


def test_add():
    assert add(2, 3) == 5
    assert add(-1, 1) == 0


def test_subtract():
    assert subtract(5, 3) == 2


def test_multiply():
    assert multiply(4, 3) == 12


def test_divide():
    assert divide(10, 2) == 5.0
    with pytest.raises(ValueError):
        divide(1, 0)


def test_power():
    assert power(2, 10) == 1024


def test_is_prime():
    assert is_prime(2) is True
    assert is_prime(3) is True
    assert is_prime(4) is False
    assert is_prime(17) is True
    assert is_prime(1) is False
    assert is_prime(0) is False
    assert is_prime(-5) is False
    assert is_prime(97) is True
    assert is_prime(100) is False
