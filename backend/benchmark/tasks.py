"""
Test prompts for benchmarking across 3 task types.
Each task has a prompt + reference answer (for ROUGE-L scoring vs fp16 baseline).
"""

QA_TASKS = [
    {
        "id": "qa_01",
        "prompt": "What is the capital of Australia and what is its population?",
        "reference": "The capital of Australia is Canberra. Its population is approximately 460,000 people.",
    },
    {
        "id": "qa_02",
        "prompt": "Explain the difference between RAM and ROM in simple terms.",
        "reference": "RAM is temporary memory used while a computer runs programs. ROM is permanent memory that stores firmware and cannot be easily changed.",
    },
    {
        "id": "qa_03",
        "prompt": "What is gradient descent in machine learning?",
        "reference": "Gradient descent is an optimization algorithm that iteratively adjusts model parameters in the direction that minimizes a loss function by following the negative gradient.",
    },
    {
        "id": "qa_04",
        "prompt": "What are the main differences between supervised and unsupervised learning?",
        "reference": "Supervised learning uses labeled training data to learn a mapping from inputs to outputs. Unsupervised learning finds patterns in unlabeled data without predefined output labels.",
    },
    {
        "id": "qa_05",
        "prompt": "What is quantization in the context of large language models?",
        "reference": "Quantization reduces the precision of model weights from float32 or float16 to lower bit formats like INT8 or INT4, reducing memory footprint and increasing inference speed with minimal quality loss.",
    },
]

CODE_TASKS = [
    {
        "id": "code_01",
        "prompt": "Write a Python function that checks if a string is a palindrome.",
        "reference": "def is_palindrome(s: str) -> bool:\n    s = s.lower().replace(' ', '')\n    return s == s[::-1]",
    },
    {
        "id": "code_02",
        "prompt": "Write a Python function to flatten a nested list.",
        "reference": "def flatten(lst):\n    result = []\n    for item in lst:\n        if isinstance(item, list):\n            result.extend(flatten(item))\n        else:\n            result.append(item)\n    return result",
    },
    {
        "id": "code_03",
        "prompt": "Write a SQL query to find the top 3 highest-paid employees from an 'employees' table with columns id, name, salary.",
        "reference": "SELECT id, name, salary FROM employees ORDER BY salary DESC LIMIT 3;",
    },
    {
        "id": "code_04",
        "prompt": "Write a Python decorator that measures and prints the execution time of a function.",
        "reference": "import time\ndef timer(func):\n    def wrapper(*args, **kwargs):\n        start = time.time()\n        result = func(*args, **kwargs)\n        print(f'{func.__name__} took {time.time()-start:.4f}s')\n        return result\n    return wrapper",
    },
    {
        "id": "code_05",
        "prompt": "Write a Python class for a simple stack with push, pop, and peek methods.",
        "reference": "class Stack:\n    def __init__(self):\n        self._items = []\n    def push(self, item):\n        self._items.append(item)\n    def pop(self):\n        return self._items.pop()\n    def peek(self):\n        return self._items[-1]",
    },
]

SUMMARIZATION_TASKS = [
    {
        "id": "sum_01",
        "prompt": "Summarize the following in 2 sentences: Large language models (LLMs) are neural networks trained on vast amounts of text data. They learn statistical patterns in language to generate coherent text, answer questions, write code, and perform reasoning tasks. Models like GPT-4, Claude, and Llama have billions of parameters and require significant compute to train but can run inference on consumer hardware when quantized.",
        "reference": "Large language models are neural networks trained on massive text datasets to perform tasks like text generation, question answering, and reasoning. Modern LLMs have billions of parameters but can be made accessible through quantization techniques.",
    },
    {
        "id": "sum_02",
        "prompt": "Summarize in 2 sentences: Quantization is a model compression technique that reduces the numerical precision of neural network weights. By converting 32-bit or 16-bit floating point weights to 8-bit or 4-bit integers, models consume significantly less memory. This enables deployment on hardware with limited VRAM while maintaining most of the original model quality.",
        "reference": "Quantization compresses neural network weights to lower bit precision, significantly reducing memory usage. It enables deployment on limited hardware while preserving most of the original model's quality.",
    },
    {
        "id": "sum_03",
        "prompt": "Summarize in 2 sentences: Australia's technology sector has seen rapid growth in artificial intelligence adoption across finance, healthcare, and government. Major banks and insurance companies are deploying on-premise LLMs to comply with data sovereignty laws that prevent sending sensitive customer data to overseas cloud providers.",
        "reference": "Australia's technology sector is rapidly adopting AI across key industries including finance and healthcare. Regulatory data sovereignty requirements are driving demand for on-premise LLM deployments.",
    },
    {
        "id": "sum_04",
        "prompt": "Summarize in 2 sentences: The GGUF format, used by llama.cpp, supports efficient CPU and GPU inference through mixed-precision quantization. It offers quantization levels from Q2 to Q8, where higher numbers preserve more quality at the cost of larger file size and memory use.",
        "reference": "GGUF is a quantization format used by llama.cpp for efficient CPU and GPU inference. It offers multiple precision levels (Q2-Q8) that trade between memory efficiency and output quality.",
    },
    {
        "id": "sum_05",
        "prompt": "Summarize in 2 sentences: Time to first token (TTFT) measures the latency between sending a prompt and receiving the first token of a response. It is the most important latency metric for interactive applications because users perceive it as response time, even if total generation takes longer.",
        "reference": "Time to first token (TTFT) measures the delay before a model begins responding. It is the critical latency metric for interactive applications as it directly determines perceived responsiveness.",
    },
]

ALL_TASKS = {
    "qa": QA_TASKS,
    "code": CODE_TASKS,
    "summarization": SUMMARIZATION_TASKS,
}
