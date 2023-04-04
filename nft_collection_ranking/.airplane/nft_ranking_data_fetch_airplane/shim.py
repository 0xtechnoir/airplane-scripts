# This file includes a shim that will execute your task code.

try:
    import airplane
except ModuleNotFoundError:
    pass
import importlib.util as util
import inspect
import json
import os
import sys
import traceback


def run(args):
    sys.path.append("/Users/bennaylor/Development/bitkraft/airplane-scripts/nft_collection_ranking")

    if len(args) != 2:
        err_msg = "usage: python ./shim.py <args>"
        print(err_msg, file=sys.stderr)
        airplane.set_output(err_msg, "error")
        sys.exit(1)

    os.chdir("/Users/bennaylor/Development/bitkraft/airplane-scripts/nft_collection_ranking")

    
    module_name = "mod.main"
    
    spec = util.spec_from_file_location(module_name, "nft_ranking_data_fetch_airplane.py")
    mod = util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    arg_dict = json.loads(args[1])
    
    main_example = """
```
def main(params):
    print(params)
```
"""
    if not hasattr(mod, "main"):
        raise Exception(f"""Task is missing a `main` function. Add a main function like so and re-deploy:
{main_example}""")
    num_params = len(inspect.signature(mod.main).parameters)
    # If the task doesn't have any parameters
    if not arg_dict:
        if num_params == 0:
            ret = mod.main()
        elif num_params == 1:
            ret = mod.main(arg_dict)
        else:
            raise Exception(f"""`main` function must have at most 1 parameter, found {num_params}. Update the main function like so and re-deploy:
{main_example}""")
    else:
        if num_params == 1:
            ret = mod.main(arg_dict)
        else:
            raise Exception(f"""`main` function must have exactly 1 parameter, found {num_params}. Update the main function like so and re-deploy:
{main_example}""")
    
    if ret is not None:
        try:
            airplane.set_output(ret)
        except NameError:
            # airplanesdk is not installed - gracefully print to stdout instead.
            # This makes it easier to use the shim in a dev environment. We ensure airplanesdk
            # is installed in production images.
            sys.stdout.flush()
            print("The airplanesdk package must be installed to set return values as task output.", file=sys.stderr)
            print("Printing return values to stdout instead.", file=sys.stderr)
            sys.stderr.flush()
            print(json.dumps(ret, indent=2))

if __name__ == "__main__":
    try:
        run(sys.argv)
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        try:
            airplane.set_output(str(e), "error")
        except NameError:
            # airplanesdk is not installed so we can't set the output.
            pass
        sys.exit(1)
