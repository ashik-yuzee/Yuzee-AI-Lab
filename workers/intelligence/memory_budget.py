"""Available RAM bounded by the worker's visible Linux cgroup limits."""
import re
from pathlib import Path


def _unescape_mount_path(value):
    return re.sub(r"\\([0-7]{3})", lambda match: chr(int(match[1], 8)), value)


def available_memory_bytes(host_available=None, proc_self=Path("/proc/self")):
    """Return the tighter host/container budget, including visible parent limits.

    Non-Linux hosts have no proc cgroup files and retain psutil's available RAM.
    An unlimited cgroup does not impose an additional limit. A finite limit with
    unreadable/invalid usage fails closed instead of promising unavailable RAM.
    """
    if host_available is None:
        import psutil
        host_available = psutil.virtual_memory().available
    budget = max(0, int(host_available))
    proc_self = Path(proc_self)
    membership_file = proc_self / "cgroup"
    mounts_file = proc_self / "mountinfo"
    if not membership_file.exists() or not mounts_file.exists():
        return budget

    memberships = {}
    for line in membership_file.read_text().splitlines():
        _, controllers, path = line.split(":", 2)
        if not controllers:
            memberships["cgroup2"] = Path(path)
        elif "memory" in controllers.split(","):
            memberships["cgroup"] = Path(path)

    for line in mounts_file.read_text().splitlines():
        before, after = line.split(" - ", 1)
        fields, mount = before.split(), after.split()
        kind = mount[0]
        if kind not in memberships or (kind == "cgroup" and "memory" not in mount[2].split(",")):
            continue
        root, mountpoint = (Path(_unescape_mount_path(fields[i])) for i in (3, 4))
        try:
            relative = memberships[kind].relative_to(root)
        except ValueError:
            # A cgroup namespace may hide the host path. Its mounted root still
            # exposes the namespace's applicable memory limit.
            relative = Path(".")
        if ".." in relative.parts:
            raise RuntimeError("Cannot resolve container memory cgroup")
        current = mountpoint / relative
        limit_name, usage_name = ("memory.max", "memory.current") if kind == "cgroup2" else (
            "memory.limit_in_bytes", "memory.usage_in_bytes")
        while True:
            limit_path = current / limit_name
            if limit_path.exists():
                try:
                    limit_text = limit_path.read_text().strip()
                    if limit_text not in ("max", "-1"):
                        limit = int(limit_text)
                        usage = int((current / usage_name).read_text().strip())
                        if limit < 0 or usage < 0:
                            raise ValueError("Negative cgroup memory counter")
                        budget = min(budget, max(0, limit - usage))
                except (OSError, ValueError) as exc:
                    raise RuntimeError("Cannot determine container memory budget") from exc
            if current == mountpoint:
                break
            current = current.parent
    return budget


def require_available_memory(minimum_bytes):
    if available_memory_bytes() < minimum_bytes:
        raise RuntimeError("At least 2 GiB available host/container memory is required before model load")
