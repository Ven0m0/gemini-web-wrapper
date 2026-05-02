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
    # Test with 1D vector
    vector = np.array([3.0, 4.0])
    normalized = normalize_l2(vector)

    assert normalized.shape == (2,)
    np.testing.assert_allclose(normalized, np.array([0.6, 0.8]), rtol=1e-5)

    # Test 1D zero vector
    zero_vector = np.array([0.0, 0.0])
    normalized_zero = normalize_l2(zero_vector)
    np.testing.assert_array_equal(normalized_zero, np.array([0.0, 0.0]))


def test_normalize_l2_empty():
    # Test with empty vector array (0x2 shape)
    vectors = np.empty((0, 2))
    normalized = normalize_l2(vectors)

    assert normalized.shape == (0, 2)


def test_normalize_l2_large_values():
    # Test with very large numbers (should not overflow if normalized properly, though np.linalg.norm handles it generally well)
    vectors = np.array([[3e100, 4e100], [0.0, 1e100]])
    normalized = normalize_l2(vectors)

    expected = np.array([[0.6, 0.8], [0.0, 1.0]])
    np.testing.assert_allclose(normalized, expected, rtol=1e-5)


def test_normalize_l2_small_values():
    # Test with very small numbers (near zero)
    vectors = np.array([[3e-100, 4e-100], [0.0, 1e-100]])
    normalized = normalize_l2(vectors)

    expected = np.array([[0.6, 0.8], [0.0, 1.0]])
    np.testing.assert_allclose(normalized, expected, rtol=1e-5)


def test_normalize_l2_negative_values():
    # Test with negative numbers
    vectors = np.array([[-3.0, -4.0], [1.0, -1.0]])
    normalized = normalize_l2(vectors)

    expected = np.array([[-0.6, -0.8], [1 / np.sqrt(2), -1 / np.sqrt(2)]])
    np.testing.assert_allclose(normalized, expected, rtol=1e-5)
