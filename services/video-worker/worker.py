# video-worker/worker.py
# Celery video rendering worker entrypoint

from media.futures.render_tasks import celery_app

if __name__ == "__main__":
    # Allows launching the worker by executing python -m video-worker.worker
    import sys
    argv = [
        "worker",
        "--loglevel=info",
        "-c", "1",  # Run with concurrency 1 since video compilation is resource intensive
    ]
    celery_app.worker_main(argv=argv)
