import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from memory_budget import available_memory_bytes, require_available_memory

GIB = 1024**3


class MemoryBudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.proc = self.root / "proc"
        self.proc.mkdir()
        self.mountpoint = self.root / "cgroup"
        self.mountpoint.mkdir()

    def mount(self, kind="cgroup2", group="/", mount_root="/"):
        controller = "" if kind == "cgroup2" else "memory"
        (self.proc / "cgroup").write_text(f"0:{controller}:{group}\n")
        options = "rw" if kind == "cgroup2" else "rw,memory"
        (self.proc / "mountinfo").write_text(
            f"29 23 0:26 {mount_root} {self.mountpoint} rw - {kind} cgroup {options}\n")

    def counters(self, path=None, limit=4 * GIB, usage=GIB, kind="cgroup2"):
        path = self.mountpoint if path is None else path
        path.mkdir(parents=True, exist_ok=True)
        names = ("memory.max", "memory.current") if kind == "cgroup2" else (
            "memory.limit_in_bytes", "memory.usage_in_bytes")
        for name, value in zip(names, (limit, usage)):
            (path / name).write_text(str(value))

    def budget(self, host=16 * GIB):
        return available_memory_bytes(host, self.proc)

    def test_non_linux_keeps_host_budget(self):
        self.assertEqual(self.budget(), 16 * GIB)

    def test_v2_container_and_host_limits(self):
        self.mount(); self.counters()
        self.assertEqual(self.budget(), 3 * GIB)
        self.assertEqual(self.budget(host=GIB), GIB)

    def test_unlimited_v2_keeps_host_budget(self):
        self.mount(); self.counters(limit="max")
        self.assertEqual(self.budget(), 16 * GIB)

    def test_v1_container_and_unlimited_limits(self):
        self.mount(kind="cgroup"); self.counters(kind="cgroup")
        self.assertEqual(self.budget(), 3 * GIB)
        self.counters(kind="cgroup", limit=9223372036854771712)
        self.assertEqual(self.budget(), 16 * GIB)

    def test_parent_cgroup_shared_limit_is_observed(self):
        self.mount(group="/worker")
        self.counters(limit=4 * GIB, usage=3 * GIB)
        self.counters(self.mountpoint / "worker", limit="max", usage=GIB)
        self.assertEqual(self.budget(), GIB)

    def test_non_root_mount_resolves_membership(self):
        self.mount(group="/docker/worker", mount_root="/docker")
        self.counters(self.mountpoint / "worker", limit=2 * GIB, usage=GIB)
        self.assertEqual(self.budget(), GIB)

    def test_over_limit_is_zero_not_negative(self):
        self.mount(); self.counters(limit=GIB, usage=2 * GIB)
        self.assertEqual(self.budget(), 0)

    def test_missing_or_invalid_usage_fails_closed(self):
        self.mount(); self.counters()
        usage = self.mountpoint / "memory.current"
        usage.unlink()
        with self.assertRaisesRegex(RuntimeError, "container memory"):
            self.budget()
        usage.write_text("invalid")
        with self.assertRaisesRegex(RuntimeError, "container memory"):
            self.budget()

    def test_threshold_preserved_at_two_gib(self):
        with patch("memory_budget.available_memory_bytes", return_value=2 * GIB - 1):
            with self.assertRaisesRegex(RuntimeError, "2 GiB"):
                require_available_memory(2 * GIB)
        with patch("memory_budget.available_memory_bytes", return_value=2 * GIB):
            require_available_memory(2 * GIB)

    def test_forecast_guard_runs_before_model_import(self):
        from forecast import load_model
        with patch("forecast.require_available_memory", side_effect=RuntimeError("preflight")) as guard:
            with self.assertRaisesRegex(RuntimeError, "preflight"):
                load_model(6)
            guard.assert_called_once_with(2 * GIB)


if __name__ == "__main__":
    unittest.main()
