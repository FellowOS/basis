"""Forward inference through semantica's Reasoner."""

from __future__ import annotations

from typing import Any


class ReasoningService:
    def infer(self, facts: list[str], rules: list[str]) -> list[Any]:
        from semantica.reasoning import Reasoner

        return Reasoner().infer_facts(facts, rules)
