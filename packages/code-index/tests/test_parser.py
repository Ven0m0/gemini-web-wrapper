import builtins
import logging

from affine.code_index.parser import ASTParser


def test_missing_grammar_does_not_drop_others(monkeypatch, caplog) -> None:
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "tree_sitter_rust":
            raise ImportError(name)
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    with caplog.at_level(logging.WARNING):
        parser = ASTParser()
    assert "rust" not in parser._configs
    assert "python" in parser._configs and "bash" in parser._configs
    assert "'rust'" in caplog.text
