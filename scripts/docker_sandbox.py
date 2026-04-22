import docker
import sys
import argparse

def run_in_sandbox(command, image="ubuntu:latest"):
    try:
        client = docker.from_env()
    except docker.errors.DockerException as e:
        print(f"Failed to connect to Docker daemon: {e}")
        return 1

    print(f"Spinning up temporary container from image: {image}")
    try:
        # Run the container detached so we can wait and get logs properly
        container = client.containers.run(
            image,
            command,
            detach=True,
            remove=False, # We'll remove it manually after getting logs
            network_disabled=False
        )
        
        result = container.wait()
        logs = container.logs().decode('utf-8')
        
        print("--- Output ---")
        print(logs)
        print(f"--- Exit Code: {result['StatusCode']} ---")
        
        # Clean up
        container.remove()
        
        return result['StatusCode']
    except docker.errors.ContainerError as e:
        print("Container Error:")
        print(e.stderr.decode('utf-8'))
        return e.exit_status
    except Exception as e:
        print(f"Error: {e}")
        return 1

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run a command in a Docker sandbox.")
    parser.add_argument("command", help="The command to execute")
    parser.add_argument("--image", default="ubuntu:latest", help="Docker image to use")
    args = parser.parse_args()
    
    sys.exit(run_in_sandbox(args.command, args.image))
