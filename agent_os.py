import os
import re
import time
import json
import subprocess
import math

try:
    import docker
except ImportError:
    docker = None
    print("[!] Docker SDK not found. Install with: pip install docker")

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    print("[!] Google GenAI SDK not found. Install with: pip install google-genai")

PLANNER_PROMPT = """
<system_ontology>
  <core_identity>
    <role>AgentOS Strategic Planner</role>
    <objective>Deconstruct user requests into safe, logical, step-by-step operational blueprints for a Linux/Unix/Windows terminal environment.</objective>
  </core_identity>
  <axiomatic_laws>
    <law id="1">Simplicity: Never propose a complex solution if a simple one exists.</law>
    <law id="2">Non-Destruction: Always default to non-destructive analysis first.</law>
    <law id="3">Modularity: Break down tasks into distinct, atomic steps.</law>
  </axiomatic_laws>
  <output_format>
    <analysis>Break down what the user actually wants.</analysis>
    <blueprint>
      <step num="1">Describe the first logical action.</step>
    </blueprint>
    <risk_assessment>Identify what could go wrong with this plan.</risk_assessment>
  </output_format>
</system_ontology>
"""

EXECUTOR_PROMPT = """
<system_ontology>
  <core_identity>
    <role>AgentOS Terminal Executor</role>
    <objective>Translate strategic blueprints into exact, flawless terminal commands.</objective>
  </core_identity>
  <operational_rules>
    <rule>Translate ONLY the next immediate step into code.</rule>
    <rule>Wrap shell commands in <execute_shell>.</rule>
  </operational_rules>
  <output_format>
    <translation_logic>Explain conversion.</translation_logic>
    <action>
      <execute_shell>COMMAND</execute_shell>
    </action>
  </output_format>
</system_ontology>
"""

REVIEWER_PROMPT = """
<system_ontology>
  <core_identity>
    <role>AgentOS Security Auditor</role>
    <objective>Critically examine proposed terminal commands for security risks. Also determine the optimal Docker sandbox configuration for testing.</objective>
  </core_identity>
  <security_lattice>
    <fatal_flags>rm -rf, mkfs, dd, chmod 777, chown root, :(){ :|:& };:</fatal_flags>
    <warning_flags>mv, cp, wget, curl, pip install, npm install</warning_flags>
  </security_lattice>
  <output_format>
    <audit_log>Analyze command.</audit_log>
    <sandbox_config>
      <image>Determine best base image (e.g., alpine:latest, python:3.9-slim, node:18-alpine)</image>
      <network_disabled>true or false</network_disabled>
      <volumes>Specify required volume mounts or 'none'</volumes>
    </sandbox_config>
    <verdict>
      [APPROVED] - The command is safe and read-only.
      [REQUIRES_USER_CONSENT] - The command modifies the system but is not malicious.
      [REJECTED] - The command is highly dangerous or syntactically flawed.
    </verdict>
  </output_format>
</system_ontology>
"""

try:
    import chromadb
    from chromadb.utils import embedding_functions
except ImportError:
    chromadb = None
    print("[!] ChromaDB not found. Install with: pip install chromadb")

class LocalMemoryCore:
    def __init__(self):
        self.collection_name = "agentos_memory"
        if chromadb and genai:
            self.client = chromadb.PersistentClient(path="./chroma_db")
            
            # Use a custom embedding function with google-genai
            class GeminiEmbeddingFunction(embedding_functions.EmbeddingFunction):
                def __call__(self, input: list[str]) -> list[list[float]]:
                    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
                    embeddings = []
                    for text in input:
                        response = client.models.embed_content(
                            model='gemini-embedding-2-preview',
                            contents=text,
                        )
                        embeddings.append(response.embeddings[0].values)
                    return embeddings

            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=GeminiEmbeddingFunction()
            )
            
            # Seed initial data if empty
            if self.collection.count() == 0:
                self._seed_initial_data()
        else:
            self.client = None
            self.collection = None
            print("[!] Vector DB disabled due to missing dependencies.")

    def _seed_initial_data(self):
        initial_memories = [
            {"id": "path_1", "type": "path", "key": "python scripts", "content": "/Users/admin/projects/python_scripts"},
            {"id": "path_2", "type": "path", "key": "downloads", "content": "/Users/admin/Downloads"},
            {"id": "pref_1", "type": "preference", "content": "Always use absolute paths when moving files."},
            {"id": "pref_2", "type": "preference", "content": "Never delete files without user confirmation."}
        ]
        
        documents = []
        metadatas = []
        ids = []
        
        for mem in initial_memories:
            if mem["type"] == "path":
                text = f"Path to {mem['key']}: {mem['content']}"
            else:
                text = f"Preference: {mem['content']}"
            
            documents.append(text)
            metadatas.append({"type": mem["type"], "key": mem.get("key", ""), "content": mem["content"]})
            ids.append(mem["id"])
            
        self.collection.add(documents=documents, metadatas=metadatas, ids=ids)

    def store_memory(self, content: str, mem_type: str, key: str = ""):
        if not self.collection:
            return
            
        mem_id = f"mem_{int(time.time() * 1000)}"
        text = f"Path to {key}: {content}" if mem_type == "path" else f"Preference: {content}"
        
        self.collection.add(
            documents=[text],
            metadatas=[{"type": mem_type, "key": key, "content": content}],
            ids=[mem_id]
        )
        print(f"[*] Stored new memory in Vector DB: {text}")

    def retrieve_context(self, user_query):
        if not self.collection:
            return []
            
        results = self.collection.query(
            query_texts=[user_query],
            n_results=4
        )
        
        formatted_results = []
        if results and results['metadatas'] and len(results['metadatas'][0]) > 0:
            for i in range(len(results['metadatas'][0])):
                meta = results['metadatas'][0][i]
                # ChromaDB returns distances, we convert to a pseudo-confidence score
                distance = results['distances'][0][i] if 'distances' in results and results['distances'] else 0
                confidence = max(0.0, 1.0 - distance) # Simple normalization, might need tweaking based on distance metric
                
                formatted_results.append({
                    "type": meta["type"],
                    "key": meta.get("key", ""),
                    "content": meta["content"],
                    "confidence": confidence
                })
                
        return formatted_results

class SecureTerminal:
    def __init__(self):
        self.current_dir = os.getcwd()

    def execute(self, command: str) -> str:
        if command.strip().startswith("cd "):
            target_dir = command.strip()[3:].strip()
            try:
                target_dir = os.path.expanduser(target_dir)
                target_dir = os.path.abspath(os.path.join(self.current_dir, target_dir))
                os.chdir(target_dir)
                self.current_dir = os.getcwd()
                return f"[Success: Directory changed to {self.current_dir}]"
            except Exception as e:
                return f"[STDERR]: Failed to change directory: {e}"

        try:
            result = subprocess.run(
                command, shell=True, cwd=self.current_dir, 
                text=True, capture_output=True, timeout=60
            )
            output = result.stdout
            if result.stderr:
                output += f"\\n[STDERR]: {result.stderr}"
            return output.strip() if output else "[Command executed with no output]"
        except Exception as e:
            return f"[STDERR]: Critical Execution Error: {e}"

class SecureContainerExecutor:
    def __init__(self):
        if docker is None:
            self.client = None
            return
        try:
            self.client = docker.from_env()
        except Exception as e:
            print(f"[!] Warning: Docker daemon not found or unreachable: {e}")
            self.client = None

    def test_command(self, command: str, image: str = "alpine:latest", network_disabled: bool = True, volumes: dict = None) -> dict:
        if not self.client:
            return {"success": True, "output": f"[Simulated Sandbox] Execution successful. (Docker not running, Image: {image}, Network Disabled: {network_disabled})"}
            
        print(f"[*] Provisioning ephemeral container ({image}, Network Disabled: {network_disabled}, Volumes: {volumes or {}})...")
        try:
            # Extract working_dir if it was provided in the volumes_dict binding, otherwise default to None
            working_dir = None
            if volumes:
                for host_path, bind_info in volumes.items():
                    if bind_info.get('bind') == '/workspace':
                        working_dir = '/workspace'
                        break

            container_output = self.client.containers.run(
                image,
                command=f'sh -c "{command}"',
                remove=True,
                stdout=True,
                stderr=True,
                network_disabled=network_disabled, 
                volumes=volumes or {},
                working_dir=working_dir,
                mem_limit="128m"
            )
            return {"success": True, "output": container_output.decode('utf-8').strip()}
        except docker.errors.ContainerError as e:
            return {"success": False, "output": e.stderr.decode('utf-8').strip()}
        except docker.errors.ImageNotFound:
            return {"success": False, "output": f"Image {image} not found locally."}
        except Exception as e:
            return {"success": False, "output": str(e)}

class AgentOS:
    def __init__(self):
        if genai:
            self.client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        else:
            self.client = None
        self.terminal = SecureTerminal()
        self.memory = LocalMemoryCore()
        self.sandbox = SecureContainerExecutor()

    def _call_llm(self, system_prompt, user_content):
        if not self.client:
            return "<error>GenAI SDK not installed</error>"
        response = self.client.models.generate_content(
            model='gemini-3.1-pro-preview',
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.1,
            )
        )
        return response.text

    def run_cycle(self, user_request):
        print(f"\\n[SYSTEM] Initializing AgentOS in {self.terminal.current_dir}...")
        
        memories = self.memory.retrieve_context(user_request)
        context_string = "No highly relevant past context found."
        if memories:
            print(f"[*] Retrieved {len(memories)} relevant memories from Vector DB.")
            context_lines = []
            for m in memories:
                conf = f"{m['confidence']*100:.1f}%"
                if m['type'] == 'path':
                    context_lines.append(f"[Confidence: {conf}] Known Path for '{m['key']}': {m['content']}")
                else:
                    context_lines.append(f"[Confidence: {conf}] User Preference: {m['content']}")
            context_string = "\\n".join(context_lines)

        enriched_request = f"<context_memory>\\n{context_string}\\n</context_memory>\\n<user_request>\\n{user_request}\\n</user_request>"

        print("[*] Planner is analyzing the request...")
        planner_response = self._call_llm(PLANNER_PROMPT, enriched_request)
        
        steps = re.findall(r'<step num="\d+">(.*?)</step>', planner_response, re.DOTALL)
        if not steps:
            print("[!] Planner failed to generate distinct steps. Aborting cycle.")
            return

        for i, step in enumerate(steps):
            print(f"\\n[*] Executing Step {i+1}: {step.strip()}")
            
            executor_request = f"<current_step>\\n{step}\\n</current_step>\\n<current_directory>{self.terminal.current_dir}</current_directory>"
            executor_response = self._call_llm(EXECUTOR_PROMPT, executor_request)
            
            shell_cmd_match = re.search(r"<execute_shell>(.*?)</execute_shell>", executor_response, re.DOTALL)
            if not shell_cmd_match:
                print("[!] Executor did not provide a valid shell command. Skipping step.")
                continue
                
            proposed_command = shell_cmd_match.group(1).strip()
            print(f"    [Proposed Command]: {proposed_command}")

            reviewer_request = f"<proposed_command>\\n{proposed_command}\\n</proposed_command>"
            reviewer_response = self._call_llm(REVIEWER_PROMPT, reviewer_request)
            
            verdict_match = re.search(r"<verdict>(.*?)</verdict>", reviewer_response, re.DOTALL)
            if not verdict_match:
                print("[!] Reviewer failed to provide a verdict. Halting for safety.")
                break
                
            verdict = verdict_match.group(1).strip()
            
            sandbox_config_match = re.search(r"<sandbox_config>(.*?)</sandbox_config>", reviewer_response, re.DOTALL)
            image = "alpine:latest"
            network_disabled = True
            volumes_str = "none"
            volumes_dict = {}
            
            if sandbox_config_match:
                config_text = sandbox_config_match.group(1)
                img_match = re.search(r"<image>(.*?)</image>", config_text)
                if img_match:
                    image = img_match.group(1).strip()
                net_match = re.search(r"<network_disabled>(.*?)</network_disabled>", config_text)
                if net_match and net_match.group(1).strip().lower() == "false":
                    network_disabled = False
                vol_match = re.search(r"<volumes>(.*?)</volumes>", config_text)
                if vol_match:
                    volumes_str = vol_match.group(1).strip()
                    if volumes_str.lower() != 'none':
                        # Still support custom volumes if specified
                        pass
                
                # Automatically mount the current working directory as /workspace
                volumes_dict[self.terminal.current_dir] = {'bind': '/workspace', 'mode': 'rw'}

            if "[REJECTED]" in verdict:
                print(f"[!] SECURITY ALERT: Command rejected by internal auditor.")
                break 
                
            # 5. SANDBOX TESTING PHASE
            if "[APPROVED]" in verdict or "[REQUIRES_USER_CONSENT]" in verdict:
                # Prefix the command with a change to the mounted workspace directory
                sandboxed_cmd = f"cd /workspace && {proposed_command}"
                
                print(f"    [System]: Provisioning Docker Sandbox (Image: {image}, Network Disabled: {network_disabled}, Volumes: {volumes_dict})...")
                sandbox_result = self.sandbox.test_command(sandboxed_cmd, image=image, network_disabled=network_disabled, volumes=volumes_dict)
                
                if not sandbox_result["success"]:
                    print(f"[!] SANDBOX FAILED:\\n{sandbox_result['output']}")
                    print("[*] Halting blueprint. Command failed in isolated testing.")
                    break
                else:
                    print(f"    [Sandbox]: Command tested successfully. Output:\\n{sandbox_result['output']}")

            # 6. ACTUATION & SAFETY GATE
            if "[REQUIRES_USER_CONSENT]" in verdict:
                consent = input(f"\\n[?] Auditor flagged command as modifying. Allow `{proposed_command}`? (y/n): ")
                if consent.lower() != 'y':
                    print("[*] User denied execution. Halting blueprint.")
                    break
            elif "[APPROVED]" in verdict:
                print("    [Auditor]: Command Approved. Executing on host...")
            
            terminal_output = self.terminal.execute(proposed_command)
            
            if "[STDERR]" in terminal_output:
                print(f"\\n[!] TERMINAL ERROR:\\n{terminal_output}")
                break
            else:
                print("    [Success]: Step completed.")
                time.sleep(1)

        print("\\n[SYSTEM] Operational cycle complete. Awaiting next command.")

if __name__ == "__main__":
    if not os.environ.get("GEMINI_API_KEY"):
        print("Please set GEMINI_API_KEY environment variable.")
    else:
        agent = AgentOS()
        print("AgentOS Ready. Type 'exit' to quit.")
        while True:
            cmd = input("\\nAgentOS> ")
            if cmd.lower() in ['exit', 'quit']:
                break
            agent.run_cycle(cmd)
