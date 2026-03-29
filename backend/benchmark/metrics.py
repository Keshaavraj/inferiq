"""
Metrics capture utilities for benchmark runs.
- TTFT (time to first token)
- Tokens per second
- VRAM / RAM usage
- ROUGE-L score vs reference
- Consistency score (std dev across 3 runs)
"""

import time
import re
import os
from typing import Optional

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def get_vram_usage_mb() -> float:
    """Returns current GPU VRAM usage in MB. Returns 0 if no GPU available."""
    if TORCH_AVAILABLE and torch.cuda.is_available():
        return torch.cuda.memory_allocated() / 1024 / 1024
    return 0.0


def get_peak_vram_mb() -> float:
    """Returns peak GPU VRAM usage in MB since last reset."""
    if TORCH_AVAILABLE and torch.cuda.is_available():
        return torch.cuda.max_memory_allocated() / 1024 / 1024
    return 0.0


def reset_vram_peak():
    if TORCH_AVAILABLE and torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()


def get_ram_usage_mb() -> float:
    """Returns current process RAM usage in MB."""
    try:
        import psutil
        import os
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / 1024 / 1024
    except ImportError:
        return 0.0


def rouge_l_score(hypothesis: str, reference: str) -> float:
    """
    Computes ROUGE-L F1 score between hypothesis and reference.
    Uses LCS (Longest Common Subsequence) approach.
    """
    def lcs_length(x, y):
        m, n = len(x), len(y)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if x[i - 1] == y[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1] + 1
                else:
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
        return dp[m][n]

    hyp_tokens = hypothesis.lower().split()
    ref_tokens = reference.lower().split()

    if not hyp_tokens or not ref_tokens:
        return 0.0

    lcs = lcs_length(hyp_tokens, ref_tokens)
    precision = lcs / len(hyp_tokens)
    recall = lcs / len(ref_tokens)

    if precision + recall == 0:
        return 0.0

    return round(2 * precision * recall / (precision + recall), 4)


def count_tokens(text: str) -> int:
    """Approximate token count (word-based, ~1.3 tokens per word)."""
    return int(len(text.split()) * 1.3)


class BenchmarkTimer:
    """Context manager to measure TTFT and total generation time."""

    def __init__(self):
        self.start_time: Optional[float] = None
        self.first_token_time: Optional[float] = None
        self.end_time: Optional[float] = None

    def start(self):
        self.start_time = time.perf_counter()

    def record_first_token(self):
        if self.first_token_time is None:
            self.first_token_time = time.perf_counter()

    def stop(self):
        self.end_time = time.perf_counter()

    @property
    def ttft_ms(self) -> float:
        if self.start_time and self.first_token_time:
            return round((self.first_token_time - self.start_time) * 1000, 2)
        return 0.0

    @property
    def total_ms(self) -> float:
        if self.start_time and self.end_time:
            return round((self.end_time - self.start_time) * 1000, 2)
        return 0.0

    def tokens_per_sec(self, token_count: int) -> float:
        total_s = (self.end_time - self.start_time) if self.end_time and self.start_time else 0
        if total_s <= 0:
            return 0.0
        return round(token_count / total_s, 2)


def compute_consistency_score(outputs: list[str]) -> float:
    """
    Measures how consistent outputs are across multiple runs.
    Uses average pairwise ROUGE-L. Score 0-1, higher = more consistent.
    """
    if len(outputs) < 2:
        return 1.0

    scores = []
    for i in range(len(outputs)):
        for j in range(i + 1, len(outputs)):
            scores.append(rouge_l_score(outputs[i], outputs[j]))

    return round(sum(scores) / len(scores), 4) if scores else 1.0
