from utils import chunk_sentence_parts


def test_chunk_sentence_parts():
    """Verify chunk_sentence_parts behaves as expected."""
    cases = [
        (
            ["Hello. ", "World."],
            ["Hello. ", "World."]
        ),
        (
            ["This is a very long sentence that will exceed the 50 character limit and should be split somewhere.", " More text."],
            ["This is a very long sentence that will exceed the 50 character limit and should be split somewhere.", " More text."]
        ),
        (
            ["", "   ", "Hello."],
            ["   Hello."]
        ),
        (
            ["Part 1 ", "Part 2 ", "Part 3 ", "Part 4 ", "Part 5 ", "Part 6 ", "Part 7 ", "Part 8 "],
            ["Part 1 Part 2 Part 3 Part 4 Part 5 Part 6 Part 7 Part 8 "]
        ),
        (
            ["Hello there! ", "Next sentence."],
            ["Hello there! ", "Next sentence."]
        ),
        (
            ["   ", "   "],
            []
        ),
        (
            ["End. ", "   "],
            ["End. "]
        ),
    ]

    for i, (input_data, expected) in enumerate(cases):
        actual = chunk_sentence_parts(input_data)
        assert actual == expected, f"Failed case {i}: Input={input_data}, Expected={expected}, Actual={actual}"
