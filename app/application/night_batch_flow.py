import logging

from app.application.firebird_image_flow import build_firebird_image_flow
from app.application.flow_store import store
from app.application.pricing_flow import build_pricing_flow
from app.infra.flow import AsyncFlow, Context


logging.basicConfig(level=logging.DEBUG, handlers=[logging.StreamHandler()])


def build_run_type_flow(params: dict, run_type: str):
    """
    Build a flow for a specific run type (e.g., 'ftb', 'hpl')

    Structure:
    - prepare_data: Prepare libraries data
    - For each library version:
      - build_image: Build Firebird image
      - run_pricing: Run pricing flow
    - calculate_diff: Calculate differences between pricing results
    - notify: Send notification
    """
    flow = AsyncFlow(f"{run_type}_flow", store)

    # Task 1: Prepare data for this run type
    @flow.task(f"prepare_{run_type}_data", name=f"Prepare {run_type.upper()} Data")
    def prepare_data(ctx: Context):
        ctx.log(f"Preparing data for {run_type}")
        libraries = params.get("libraries", [])
        ctx.log(f"Found {len(libraries)} libraries to process: {[lib.get('version') for lib in libraries]}")
        ctx.push({"libraries": libraries, "run_type": run_type})

    libraries = params.get("libraries", [])
    pricing_flow_tasks = []

    # For each library version, create build and pricing flows
    for library in libraries:
        version = library.get("version")
        build_task_id = f"build_{run_type}_{version}_image"
        pricing_task_id = f"run_{run_type}_{version}_pricing"

        # Task: Build Firebird image for this version
        @flow.subflow(
            build_task_id,
            name=f"Build {run_type.upper()} v{version} Image",
            params=library,
            depends_on=[f"prepare_{run_type}_data"]
        )
        def build_library_image(ctx: Context):
            return build_firebird_image_flow(f"{run_type}_{version}")

        # Task: Run pricing flow for this version
        @flow.subflow(
            pricing_task_id,
            name=f"Run {run_type.upper()} v{version} Pricing",
            depends_on=[build_task_id]
        )
        def run_library_pricing(ctx: Context):
            return build_pricing_flow(f"{run_type}_{version}_pricing")

        pricing_flow_tasks.append(pricing_task_id)

    # Task: Calculate differences between all pricing results
    @flow.task(
        f"calculate_{run_type}_diff",
        name=f"Calculate {run_type.upper()} Differences",
        depends_on=pricing_flow_tasks
    )
    def calculate_differences(ctx: Context):
        ctx.log(f"Calculating differences for {run_type}")
        ctx.log(f"Comparing results from {len(pricing_flow_tasks)} pricing flows")

    # Task: Send notification for this run type
    @flow.task(
        f"notify_{run_type}_complete",
        name=f"Notify {run_type.upper()} Complete",
        depends_on=[f"calculate_{run_type}_diff"]
    )
    def notify_complete(ctx: Context):
        ctx.log(f"Sending notification for {run_type} completion")

    return flow


def build_night_batch_flow(params: dict = None):
    """
    Main Night Batch Flow

    Structure:
    - prepare_batch_data: Prepare all run types and libraries
    - For each run type (ftb, hpl, etc.):
      - run_type_flow: Execute the complete flow for that type
    - notify_batch_complete: Send final notification
    """
    flow = AsyncFlow("Night Batch Flow", store)

    # Task 1: Prepare batch data (first task before everything)
    @flow.task("prepare_batch_data", name="Prepare Batch Data")
    def prepare_batch_data(ctx: Context):
        ctx.log("Preparing night batch data")
        run_types = params.get("run_types", [])
        libraries = params.get("libraries", [])
        ctx.log(f"Run types: {[rt.get('type') for rt in run_types]}")
        ctx.log(f"Libraries: {[lib.get('version') for lib in libraries]}")
        ctx.push({"run_types": run_types, "libraries": libraries})

    run_type_flow_tasks = []

    # For each run type, create its flow
    for run_type_config in params.get("run_types", []):
        run_type = run_type_config.get("type")
        flow_task_id = f"run_{run_type}_flow"

        @flow.subflow(
            flow_task_id,
            name=f"Run {run_type.upper()} Flow",
            depends_on=["prepare_batch_data"]
        )
        def execute_run_type_flow(ctx: Context):
            return build_run_type_flow(params, run_type=run_type)

        run_type_flow_tasks.append(flow_task_id)

    # Final task: Send batch completion notification
    @flow.task(
        "notify_batch_complete",
        name="Notify Batch Complete",
        depends_on=run_type_flow_tasks
    )
    def notify_batch_complete(ctx: Context):
        ctx.log("Night batch processing complete")
        ctx.log("Sending final Symphony notification")

    return flow
