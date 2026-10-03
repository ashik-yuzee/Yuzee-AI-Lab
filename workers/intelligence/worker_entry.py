"""Container entrypoint. Secrets come from the environment, never CLI arguments."""
import os
import sys


def main():
    stage = sys.argv[1] if len(sys.argv) > 1 else 'pipeline'
    if 'NEO4J_AUTH' in os.environ and not os.getenv('NEO4J_PASSWORD'):
        user, separator, password = os.environ['NEO4J_AUTH'].partition('/')
        if not separator or not password:
            raise ValueError('Invalid graph authentication reference')
        os.environ.update(NEO4J_USER=user, NEO4J_PASSWORD=password)
    sys.argv = [sys.argv[0]] + sys.argv[2:]
    if stage == 'pipeline':
        from pipeline_local import main as pipeline
        pipeline()
    elif stage == 'cache':
        from cache_model import cache
        cache()
    elif stage == 'test':
        import unittest
        suite = unittest.defaultTestLoader.discover('/app', pattern='test_*.py')
        sys.exit(0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1)
    else:
        raise SystemExit('Usage: worker_entry.py pipeline|cache|test [options]')


if __name__ == '__main__':
    main()
