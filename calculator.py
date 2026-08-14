"""Simple calculator module."""


def add(a, b):
    return a + b


def subtract(a, b):
    return a - b


def multiply(a, b):
    # TODO: handle complex numbers
    return a * b


def divide(a, b):
    # TODO: add support for returning fractions (e.g. Fraction type) instead of floats
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b


def power(a, b):
    # TODO: implement using iterative multiplication for integer exponents to avoid float precision issues
    return a ** b


def is_prime(n):
    """Return True if n is a prime number, False otherwise."""
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    for i in range(3, int(n ** 0.5) + 1, 2):
        if n % i == 0:
            return False
    return True


def factorial(n):
    # TODO: implement factorial
    raise NotImplementedError
