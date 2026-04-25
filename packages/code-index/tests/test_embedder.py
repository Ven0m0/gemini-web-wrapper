import numpy as np
from affine.code_index.embedder import normalize_l2


def test_normalize_l2():
    # Test with standard vectors
    vectors = np.array([[3.0, 4.0], [1.0, 1.0], [0.0, 5.0]])
    normalized = normalize_l2(vectors)

    # Check shape
    assert normalized.shape == vectors.shape

    # Check that norms are 1
    norms = np.linalg.norm(normalized, axis=1)
    np.testing.assert_allclose(norms, np.ones(3), rtol=1e-5)

    # Check specific values
    expected = np.array([[0.6, 0.8], [1 / np.sqrt(2), 1 / np.sqrt(2)], [0.0, 1.0]])
    np.testing.assert_allclose(normalized, expected, rtol=1e-5)


def test_normalize_l2_zero_vector():
    # Test with zero vector
    vectors = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0]])
    normalized = normalize_l2(vectors)

    # Check zero vector remains zero
    np.testing.assert_array_equal(normalized[0], np.array([0.0, 0.0, 0.0]))

    # Check non-zero vector is normalized
    np.testing.assert_array_equal(normalized[1], np.array([1.0, 0.0, 0.0]))


def test_normalize_l2_1d():
    # Test with standard 1D vector
    vector = np.array([3.0, 4.0])
    normalized = normalize_l2(vector)

    # Check shape
    assert normalized.shape == vector.shape

    # Check that norm is 1
    norm = np.linalg.norm(normalized, axis=-1)
    np.testing.assert_allclose(norm, 1.0, rtol=1e-5)

    # Check specific values
    expected = np.array([0.6, 0.8])
    np.testing.assert_allclose(normalized, expected, rtol=1e-5)


def test_normalize_l2_zero_vector_1d():
    # Test with zero 1D vector
    vector = np.array([0.0, 0.0, 0.0])
    normalized = normalize_l2(vector)

    # Check zero vector remains zero
    np.testing.assert_array_equal(normalized, np.array([0.0, 0.0, 0.0]))
