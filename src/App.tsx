import { useState, useRef, useEffect, ReactNode } from "react";
import {
  Terminal,
  Brain,
  ShieldCheck,
  Cpu,
  Database,
  Activity,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Zap,
  Box,
  Circle,
  Plus,
  Trash2,
  Search,
  Save,
  Download,
  Settings,
  MessageSquare,
  Network,
  Globe,
  Image as ImageIcon,
  Video,
  Mic,
  PlayCircle,
  Calendar as CalendarIcon,
  Clock,
  GripVertical,
  User,
  BarChart,
  Layers,
  Filter,
  Maximize,
  History,
  Send,
  Share2,
  Copy,
} from "lucide-react";
import { runPlanner, runExecutor, runReviewer, runChat, generateMediaImage, generateMediaVideo, runExplorer, runOrchestrator } from "./lib/gemini";
import { memoryCore, MemoryResult } from "./lib/memory";
import { LiveVideoChat } from "./lib/live";
import { motion, AnimatePresence } from "motion/react";
import { AgentOSSidebar } from "./components/AgentOSSidebar";
import { OrchestratorSidebar } from "./components/OrchestratorSidebar";
import { ExplorerSidebar } from "./components/ExplorerSidebar";
import { MediaSidebar } from "./components/MediaSidebar";
import { LiveSidebar } from "./components/LiveSidebar";
import { MusicPlayer } from "./components/MusicPlayer";
import { TaskDependencyGraph } from "./components/TaskDependencyGraph";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { runToolWithFailsafe } from "./services/ToolRunner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { format, parseISO, isValid } from "date-fns";

type AgentStatus = "idle" | "working" | "done" | "error";
type AppMode = 'agentos' | 'chat' | 'orchestrator' | 'explorer' | 'media' | 'live' | 'github';

interface Task {
  id: string;
  text: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignedAgent?: AppMode;
  dependencies: string[];
  dueDate: string | null;
}

interface LogEntry {
  id: string;
  type: "user" | "system" | "planner" | "executor" | "reviewer" | "sandbox" | "terminal";
  content: string;
  timestamp: Date;
  status?: "success" | "warning" | "error";
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('agentos');
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentDir, setCurrentDir] = useState("/home/user/projects");
  const [activeMemories, setActiveMemories] = useState<MemoryResult[]>([]);

  // Additional Mode States
  const [envVars, setEnvVars] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('envVars');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('envVars', JSON.stringify(envVars));
  }, [envVars]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  const [explorerLogs, setExplorerLogs] = useState<{query: string, result: string}[]>([]);
  const [isExploring, setIsExploring] = useState(false);
  const [orchestratorLogs, setOrchestratorLogs] = useState<{task: string, subtasks: string[]}[]>([]);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Offline");
  const [liveTranscripts, setLiveTranscripts] = useState<{text: string, role: 'user' | 'model'}[]>([]);
  const [liveLogs, setLiveLogs] = useState<{message: string, type: 'info' | 'success' | 'error'}[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveChatRef = useRef<LiveVideoChat | null>(null);

  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("leftSidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("rightSidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [isExplorerWidgetOpen, setIsExplorerWidgetOpen] = useState(() => {
    const saved = localStorage.getItem("isExplorerWidgetOpen");
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem("leftSidebarCollapsed", JSON.stringify(leftSidebarCollapsed));
  }, [leftSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem("rightSidebarCollapsed", JSON.stringify(rightSidebarCollapsed));
  }, [rightSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem("isExplorerWidgetOpen", JSON.stringify(isExplorerWidgetOpen));
  }, [isExplorerWidgetOpen]);

  const getPlaceholder = () => {
    switch (mode) {
      case 'agentos': return 'Issue neural command...';
      case 'chat': return 'Type a message to the AI...';
      case 'orchestrator': return 'Define a new objective...';
      case 'explorer': return 'Search the digital frontier...';
      case 'media': return 'Describe your vision...';
      case 'live': return 'Speak to the live intelligence...';
      default: return 'Enter command...';
    }
  };

  // Sandbox Config Override
  const [sandboxConfig, setSandboxConfig] = useState({
    image: "",
    network: "auto",
    volumes: "",
  });

  const saveState = () => {
    const state = {
      plannerStatus, plannerData,
      executorStatus, executorData,
      reviewerStatus, reviewerData,
      sandboxStatus, sandboxData,
      logs, currentDir
    };
    localStorage.setItem('agentos_state', JSON.stringify(state));
    addLog("system", "Agent state saved successfully.", "success");
  };

  const loadState = () => {
    const saved = localStorage.getItem('agentos_state');
    if (saved) {
      const state = JSON.parse(saved);
      setPlannerStatus(state.plannerStatus);
      setPlannerData(state.plannerData);
      setExecutorStatus(state.executorStatus);
      setExecutorData(state.executorData);
      setReviewerStatus(state.reviewerStatus);
      setReviewerData(state.reviewerData);
      setSandboxStatus(state.sandboxStatus);
      setSandboxData(state.sandboxData);
      setLogs(state.logs.map((l: any) => ({...l, timestamp: new Date(l.timestamp)})));
      setCurrentDir(state.currentDir);
      addLog("system", "Agent state loaded successfully.", "success");
    } else {
      addLog("system", "No saved state found.", "error");
    }
  };

  // Task Management
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("agentos_tasks");
    return saved ? JSON.parse(saved) : [];
  });
  const [newTaskText, setNewTaskText] = useState("");
  const [orchestratorView, setOrchestratorView] = useState<'board' | 'calendar'>('board');
  const [boardGrouping, setBoardGrouping] = useState<'status' | 'priority'>('status');
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskTemplates, setTaskTemplates] = useState<{name: string, task: Partial<Task>}[]>(() => {
    const saved = localStorage.getItem("agentos_task_templates");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("agentos_task_templates", JSON.stringify(taskTemplates));
  }, [taskTemplates]);

  // Refs for Live agent to avoid stale closures
  const tasksRef = useRef(tasks);
  const modeRef = useRef(mode);
  const explorerLogsRef = useRef(explorerLogs);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { explorerLogsRef.current = explorerLogs; }, [explorerLogs]);

  useEffect(() => {
    localStorage.setItem("agentos_tasks", JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (!newTaskText.trim()) return;
    setTasks([...tasks, { 
      id: Date.now().toString(), 
      text: newTaskText.trim(), 
      status: 'todo',
      priority: 'medium',
      dependencies: [],
      dueDate: null
    }]);
    setNewTaskText("");
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        return { ...t, status: t.status === 'done' ? 'todo' : 'done' };
      }
      return t;
    }));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    
    const newTasks = [...tasks];
    const taskIndex = newTasks.findIndex(t => t.id === result.draggableId);
    if (taskIndex === -1) return;

    if (boardGrouping === 'status') {
      if (source.droppableId !== destination.droppableId) {
        newTasks[taskIndex].status = destination.droppableId as 'todo' | 'in-progress' | 'done';
      }
    } else {
      if (source.droppableId !== destination.droppableId) {
        newTasks[taskIndex].priority = destination.droppableId as 'low' | 'medium' | 'high';
      }
    }
    
    // Reorder within the same list or across lists
    const [removed] = newTasks.splice(taskIndex, 1);
    // Find new position in the global list
    // This is a bit tricky since tasks is a flat list. 
    // For simplicity, we'll just append to the end of the new group's logical position if needed,
    // but since it's a flat list, we'll just keep it at the end of the array for now.
    newTasks.push(removed);
    setTasks(newTasks);
  };

  const updateTaskField = (id: string, field: keyof Task, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const executeTask = async (task: Task) => {
    const targetMode = task.assignedAgent || mode;
    
    const result = await runToolWithFailsafe(
      `Task-${task.id}`,
      async () => {
        if (targetMode === 'agentos') {
          handleRunCycle(task.text);
        } else if (targetMode === 'chat') {
          handleChatSubmit(task.text);
        } else if (targetMode === 'media') {
          handleMediaGenerate(task.text);
        } else if (targetMode === 'explorer') {
          handleExplorerSubmit(task.text, task.id);
        } else if (targetMode === 'orchestrator') {
          handleOrchestratorSubmit(task.text);
        }
        return { status: "completed" };
      },
      addLog
    );

    if (result.success) {
      updateTaskField(task.id, 'status', 'done');
    } else {
      addLog("system", `Task ${task.id} failed: ${result.error}`, "error");
    }
  };

  const pipelineTask = (task: Task) => {
    // Check dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      const incompleteDeps = task.dependencies.filter(depId => {
        const depTask = tasks.find(t => t.id === depId);
        return depTask && depTask.status !== 'done';
      });
      if (incompleteDeps.length > 0) {
        addLog("system", `Cannot run task "${task.text}". Waiting on ${incompleteDeps.length} dependencies.`, "error");
        return;
      }
    }

    executeTask(task);
  };

  const handleChatSubmit = async (text: string) => {
    if (!text.trim()) return;
    const newLogs = [...chatLogs, { role: 'user', text }];
    setChatLogs(newLogs);
    const history = newLogs.map(l => `${l.role}: ${l.text}`).join('\n');
    try {
      const response = await runChat(text, history);
      setChatLogs([...newLogs, { role: 'agent', text: response }]);
    } catch (e) {
      setChatLogs([...newLogs, { role: 'agent', text: 'Error connecting to chat agent.' }]);
    }
  };

  const handleMediaGenerate = async (prompt: string, type: "image" | "video" = "image") => {
    if (!prompt.trim()) return;
    setIsGeneratingMedia(true);
    setMediaType(type);
    setMediaUrl("");
    try {
      if (type === "image") {
        const url = await generateMediaImage(prompt);
        setMediaUrl(url);
      } else {
        const url = await generateMediaVideo(prompt);
        setMediaUrl(url);
      }
    } catch (e) {
      addLog("system", `Failed to generate ${type}.`, "error");
    }
    setIsGeneratingMedia(false);
  };

  const handleExplorerSubmit = async (query: string, taskId?: string) => {
    if (!query.trim()) return;
    setIsExploring(true);
    try {
      const result = await runExplorer(query);
      setExplorerLogs(prev => [...prev, { query, result }]);
      
      // Parse handoff
      const handoffMatch = result.match(/<handoff>([\s\S]*?)<\/handoff>/);
      if (handoffMatch) {
        try {
          const handoffData = JSON.parse(handoffMatch[1]);
          if (Array.isArray(handoffData)) {
            addLog("system", `Explorer identified ${handoffData.length} high-value tasks. Handing off to Orchestrator...`, "success");
            
            // Process handoff actions
            const subtasksAdded: string[] = [];
            
            setTasks(prev => {
              let updatedTasks = [...prev];
              for (const action of handoffData) {
                if (action.action === 'add' && action.text) {
                  const newTask: Task = { 
                    id: Math.random().toString(36).substring(7), 
                    text: action.text, 
                    status: action.status || 'todo', 
                    priority: action.priority || 'medium',
                    assignedAgent: action.agent as AppMode,
                    dependencies: action.dependencies || [],
                    dueDate: action.dueDate || null
                  };
                  updatedTasks.push(newTask);
                  subtasksAdded.push(`Added: ${action.text} (Agent: ${action.agent || 'none'})`);
                }
              }
              return updatedTasks;
            });
            
            setOrchestratorLogs(prev => [...prev, { task: `Handoff from Explorer: ${query}`, subtasks: subtasksAdded }]);
          }
        } catch (err) {
          console.error("Failed to parse explorer handoff:", err);
        }
      }

      if (taskId) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'done' } : t));
      }
    } catch (e) {
      setExplorerLogs(prev => [...prev, { query, result: "Error during exploration." }]);
    }
    setIsExploring(false);
  };

  const handleOrchestratorSubmit = async (taskText: string) => {
    if (!taskText.trim()) return;
    setIsOrchestrating(true);
    try {
      const explorerContext = explorerLogs.slice(-3).map(l => `Q: ${l.query}\nA: ${l.result}`).join('\n\n');
      const actions = await runOrchestrator(taskText, tasksRef.current, explorerContext);
      
      const subtasksAdded: string[] = [];
      const tasksToRun: Task[] = [];
      
      setTasks(prev => {
        let updatedTasks = [...prev];
        for (const action of actions) {
          if (action.action === 'add' && action.text) {
            const newTask: Task = { 
              id: Math.random().toString(36).substring(7), 
              text: action.text, 
              status: action.status || 'todo', 
              priority: action.priority || 'medium',
              assignedAgent: action.agent as AppMode,
              dependencies: action.dependencies || [],
              dueDate: action.dueDate || null
            };
            updatedTasks.push(newTask);
            subtasksAdded.push(`Added: ${action.text} (Agent: ${action.agent || 'none'})`);
          } else if (action.action === 'remove' && action.id) {
            updatedTasks = updatedTasks.filter(t => t.id !== action.id);
            subtasksAdded.push(`Removed task: ${action.id}`);
          } else if (action.action === 'update' && action.id) {
            updatedTasks = updatedTasks.map(t => t.id === action.id ? { 
              ...t, 
              text: action.text || t.text, 
              assignedAgent: (action.agent as AppMode) || t.assignedAgent,
              status: action.status || t.status,
              priority: action.priority || t.priority,
              dependencies: action.dependencies || t.dependencies,
              dueDate: action.dueDate !== undefined ? action.dueDate : t.dueDate
            } : t);
            subtasksAdded.push(`Updated task ${action.id}`);
          } else if (action.action === 'run' && action.id) {
            const taskToRun = updatedTasks.find(t => t.id === action.id);
            if (taskToRun) {
              tasksToRun.push(taskToRun);
              subtasksAdded.push(`Queued task for execution: ${taskToRun.text}`);
            }
          }
        }
        return updatedTasks;
      });
      
      setOrchestratorLogs(prev => [...prev, { task: taskText, subtasks: subtasksAdded }]);

      // Run queued tasks
      for (const task of tasksToRun) {
        pipelineTask(task);
      }
    } catch (e) {
      setOrchestratorLogs(prev => [...prev, { task: taskText, subtasks: ["Error orchestrating task."] }]);
    }
    setIsOrchestrating(false);
  };

  const toggleLiveChat = () => {
    if (liveStatus === "Offline" || liveStatus.startsWith("Error")) {
      if (videoRef.current && canvasRef.current) {
        setLiveTranscripts([]);
        setLiveLogs([]);
        liveChatRef.current = new LiveVideoChat(
          videoRef.current,
          canvasRef.current,
          setLiveStatus,
          (text, role) => {
            setLiveTranscripts(prev => [...prev.slice(-10), { text, role }]);
          },
          async (name, args) => {
            setLiveLogs(prev => [...prev.slice(-10), { message: `Executing: ${name}`, type: 'info' }]);
            if (name === 'addTask') {
              const newTask: Task = {
                id: Math.random().toString(36).substring(7),
                text: args.text,
                status: 'todo',
                priority: args.priority || 'medium',
                assignedAgent: args.agent || 'orchestrator',
                dependencies: [],
                dueDate: null
              };
              setTasks(prev => [...prev, newTask]);
              addLog("system", `Live Agent added task: ${args.text}`, "success");
              setLiveLogs(prev => [...prev.slice(-10), { message: `Task added: ${args.text}`, type: 'success' }]);
              return { status: "Task added successfully" };
            }
            if (name === 'startExploration') {
              handleExplorerSubmit(args.query);
              addLog("system", `Live Agent initiated exploration: ${args.query}`, "success");
              setLiveLogs(prev => [...prev.slice(-10), { message: `Exploration started: ${args.query}`, type: 'success' }]);
              return { status: "Exploration started" };
            }
            if (name === 'generateMedia') {
              if (args.type === 'image') {
                await generateMediaImage(args.prompt);
              } else {
                await generateMediaVideo(args.prompt);
              }
              addLog("system", `Live Agent generated ${args.type}: ${args.prompt}`, "success");
              setLiveLogs(prev => [...prev.slice(-10), { message: `Media generated: ${args.prompt}`, type: 'success' }]);
              return { status: "Media generated successfully" };
            }
            if (name === 'getAppState') {
              return {
                tasks: tasksRef.current.map(t => ({ id: t.id, text: t.text, status: t.status })),
                currentMode: modeRef.current,
                lastExplorerResult: explorerLogsRef.current[explorerLogsRef.current.length - 1]?.result
              };
            }
            return { error: "Unknown tool" };
          }
        );
        liveChatRef.current.start();
      }
    } else {
      liveChatRef.current?.stop();
      setIsScreenSharing(false);
    }
  };

  const toggleScreenShare = async () => {
    if (liveChatRef.current) {
      await liveChatRef.current.toggleScreenShare();
      setIsScreenSharing(prev => !prev);
    }
  };

  // Agent States
  const [plannerStatus, setPlannerStatus] = useState<AgentStatus>("idle");
  const [executorStatus, setExecutorStatus] = useState<AgentStatus>("idle");
  const [reviewerStatus, setReviewerStatus] = useState<AgentStatus>("idle");
  const [sandboxStatus, setSandboxStatus] = useState<AgentStatus>("idle");

  // Parsed Agent Outputs
  const [plannerData, setPlannerData] = useState<{
    analysis: string;
    steps: string[];
    risk: string;
  } | null>(null);
  const [executorData, setExecutorData] = useState<{
    logic: string;
    command: string;
  } | null>(null);
  const [reviewerData, setReviewerData] = useState<{
    audit: string;
    verdict: string;
  } | null>(null);
  const [sandboxData, setSandboxData] = useState<{
    containerId: string;
    image: string;
    network: string;
    volumes: string;
    output: string;
    exitCode: number;
  } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (
    type: LogEntry["type"],
    content: string,
    status?: LogEntry["status"],
  ) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        type,
        content,
        timestamp: new Date(),
        status,
      },
    ]);
  };

  const parseXML = (xml: string, tag: string) => {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
    const match = xml.match(regex);
    return match ? match[1].trim() : "";
  };

  const parseSteps = (xml: string) => {
    const steps: string[] = [];
    const regex = /<step[^>]*>([\s\S]*?)<\/step>/gi;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      steps.push(match[1].trim());
    }
    return steps;
  };

  const handleRunCycle = async (overrideInput?: string) => {
    const requestText = overrideInput || input;
    if (!requestText.trim() || isRunning) return;

    const userRequest = requestText.trim();
    if (!overrideInput) setInput("");
    setIsRunning(true);

    // Reset states
    setPlannerData(null);
    setExecutorData(null);
    setReviewerData(null);
    setSandboxData(null);
    setPlannerStatus("idle");
    setExecutorStatus("idle");
    setReviewerStatus("idle");
    setSandboxStatus("idle");

    addLog("user", userRequest);

    // --- BUILT-IN COMMANDS (File Search) ---
    if (userRequest.toLowerCase().startsWith('search ') || userRequest.toLowerCase().startsWith('find ')) {
      const query = userRequest.replace(/^(search|find)\s+/i, '').trim();
      addLog("system", `Searching for files matching '${query}' in ${currentDir}...`);
      
      setTimeout(() => {
        const mockResults = [
          `${currentDir}/src/${query.replace(/\s+/g, '_')}.ts`,
          `${currentDir}/docs/${query.replace(/\s+/g, '_')}_notes.md`,
          `${currentDir}/archive_${query.replace(/\s+/g, '_')}.zip`
        ];
        addLog("system", `Found ${mockResults.length} matches:\n  - ${mockResults.join('\n  - ')}`, "success");
        setIsRunning(false);
      }, 800);
      return;
    }

    addLog("system", `Initializing AgentOS in ${currentDir}...`);

    try {
      // --- MEMORY RETRIEVAL PHASE ---
      addLog('system', 'Querying Vector DB for semantic context...');
      const memories = await memoryCore.retrieveContext(userRequest);
      setActiveMemories(memories);
      
      let contextString = "No highly relevant past context found.";
      if (memories.length > 0) {
        contextString = memories.map(m => 
          `[Confidence: ${(m.confidence * 100).toFixed(1)}%] ${m.type === 'path' ? `Known Path for '${m.key}': ${m.content}` : `User Preference: ${m.content}`}`
        ).join('\n');
        addLog('system', `Retrieved ${memories.length} relevant memories from Vector DB.`);
      }

      // --- PLANNER PHASE ---
      setPlannerStatus("working");
      addLog("system", "Planner is analyzing the request...");

      const plannerResponse = await runPlanner(userRequest, contextString);

      const callExplorerMatch = plannerResponse.match(/<call_explorer>([\s\S]*?)<\/call_explorer>/);
      if (callExplorerMatch) {
        const query = callExplorerMatch[1].trim();
        addLog("planner", `Delegating research to Explorer: ${query}`);
        setPlannerStatus("idle");
        
        setIsExploring(true);
        addLog("system", `Running Explorer Agent for query: ${query}`);
        try {
          const explorerResult = await runExplorer(query);
          addLog("system", `Explorer returned results. Feeding back to Planner.`);
          setExplorerLogs(prev => [...prev, { query, result: explorerResult }]);
          
          // Feed back into the next run cycle
          setTimeout(() => {
            handleRunCycle(`Explorer Agent Research Results for "${query}":\n${explorerResult}\n\nPlease continue planning based on these results.`);
          }, 1000);
        } catch (e) {
          addLog("system", `Explorer Agent failed.`, "error");
        }
        setIsExploring(false);
        setIsRunning(false);
        return;
      }

      const analysis = parseXML(plannerResponse, "analysis");
      const risk = parseXML(plannerResponse, "risk_assessment");
      const steps = parseSteps(plannerResponse);

      setPlannerData({ analysis, steps, risk });
      setPlannerStatus("done");

      if (steps.length === 0) {
        addLog(
          "system",
          "Planner failed to generate distinct steps. Aborting cycle.",
          "error",
        );
        setIsRunning(false);
        return;
      }

      addLog(
        "planner",
        `Generated ${steps.length} steps. Proceeding with Step 1: ${steps[0]}`,
      );

      // --- EXECUTOR PHASE ---
      setExecutorStatus("working");
      addLog("system", `Executing Step 1: ${steps[0]}`);

      const executorResponse = await runExecutor(steps[0], currentDir);

      const logic = parseXML(executorResponse, "translation_logic");
      const command =
        parseXML(executorResponse, "execute_shell") ||
        parseXML(executorResponse, "write_file");

      setExecutorData({ logic, command });
      setExecutorStatus("done");

      if (!command) {
        addLog(
          "system",
          "Executor did not provide a valid shell command. Aborting.",
          "error",
        );
        setIsRunning(false);
        return;
      }

      addLog("executor", `Proposed Command: ${command}`);

      // --- REVIEWER PHASE ---
      setReviewerStatus("working");
      addLog("system", "Auditor is reviewing the proposed command...");

      const reviewerResponse = await runReviewer(command);

      const audit = parseXML(reviewerResponse, "audit_log");
      const verdictRaw = parseXML(reviewerResponse, "verdict");
      const sandboxConfigRaw = parseXML(reviewerResponse, "sandbox_config");
      
      let image = "alpine:latest";
      let networkDisabled = true;
      let volumes = "none";

      if (sandboxConfigRaw) {
        image = parseXML(sandboxConfigRaw, "image") || image;
        networkDisabled = parseXML(sandboxConfigRaw, "network_disabled") !== "false";
        volumes = parseXML(sandboxConfigRaw, "volumes") || volumes;
      }

      // Apply overrides
      if (sandboxConfig.image.trim()) image = sandboxConfig.image.trim();
      if (sandboxConfig.network === "enabled") networkDisabled = false;
      if (sandboxConfig.network === "disabled") networkDisabled = true;
      if (sandboxConfig.volumes.trim()) volumes = sandboxConfig.volumes.trim();

      let verdict = "UNKNOWN";
      if (verdictRaw.includes("[APPROVED]")) verdict = "APPROVED";
      else if (verdictRaw.includes("[REQUIRES_USER_CONSENT]"))
        verdict = "REQUIRES_USER_CONSENT";
      else if (verdictRaw.includes("[REJECTED]")) verdict = "REJECTED";

      setReviewerData({ audit, verdict });
      setReviewerStatus("done");

      if (verdict === "REJECTED") {
        addLog(
          "reviewer",
          `SECURITY ALERT: Command rejected.\nAudit Log: ${audit}`,
          "error",
        );
        addLog("system", "Halting blueprint for safety.", "error");
      } else {
        // --- DOCKER SANDBOX PHASE ---
        setSandboxStatus("working");
        addLog("system", `Provisioning ephemeral Docker container (${image})...`);
        
        await new Promise(r => setTimeout(r, 1200)); // Simulate container spin-up
        const containerId = `cnt_${Math.random().toString(36).substring(2, 8)}`;
        addLog("sandbox", `Container ${containerId} (${image}) online. Network: ${networkDisabled ? 'Disabled' : 'Enabled'}. Executing command...`);
        
        await new Promise(r => setTimeout(r, 1500)); // Simulate execution
        
        setSandboxData({
          containerId,
          image,
          network: networkDisabled ? "Disabled" : "Enabled",
          volumes,
          output: `$ ${command}\n> Execution successful.\n> No destructive side-effects detected.`,
          exitCode: 0
        });
        
        addLog("sandbox", `Command tested successfully. Destroying container ${containerId}...`, "success");
        setSandboxStatus("done");

        // --- HOST EXECUTION PHASE ---
        if (verdict === "REQUIRES_USER_CONSENT") {
          addLog(
            "reviewer",
            `Auditor flagged command as modifying. Requires user consent to run on host: \`${command}\``,
            "warning",
          );
          addLog(
            "system",
            "Awaiting user consent... (Simulation: auto-approving for demo purposes)",
            "warning",
          );
          setTimeout(() => simulateExecution(command), 1500);
        } else if (verdict === "APPROVED") {
          addLog("reviewer", "Command Approved and Sandboxed. Executing on host...", "success");
          simulateExecution(command);
        }
      }
    } catch (error: any) {
      addLog("system", `Critical Error: ${error.message}`, "error");
      setPlannerStatus("error");
      setExecutorStatus("error");
      setReviewerStatus("error");
      setSandboxStatus("error");
    } finally {
      if (!reviewerData || reviewerData.verdict === "REJECTED") {
        setIsRunning(false);
        addLog("system", "Operational cycle complete. Awaiting next command.");
      }
    }
  };

  const simulateExecution = (command: string) => {
    const envString = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join(' ');
    addLog("terminal", `$ ${envString} ${command}`);
    setTimeout(() => {
      if (command.startsWith("cd ")) {
        const newDir = command.replace("cd ", "").trim();
        setCurrentDir((prev) =>
          prev.endsWith("/") ? prev + newDir : prev + "/" + newDir,
        );
        addLog("terminal", `[Success: Directory changed]`);
      } else {
        addLog(
          "terminal",
          `[Simulated Output for: ${envString} ${command}]\nExecution successful.`,
        );
      }
      addLog("system", "Step completed.", "success");
      addLog("system", "Operational cycle complete. Awaiting next command.");
      setIsRunning(false);
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-[#050505] text-gray-200 font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* 3D-ish Mascot / Coach */}
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="fixed bottom-8 right-8 z-[100] pointer-events-none"
        >
          <div className="relative">
            <motion.div 
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 2, -2, 0]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 glass-panel rounded-full flex items-center justify-center border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)] pointer-events-auto cursor-pointer group"
            >
              <div className="relative">
                <Brain className="w-10 h-10 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                <motion.div 
                  animate={{ opacity: [0.2, 0.8, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full blur-[2px]"
                />
              </div>
            </motion.div>
            
            {/* JIT Coach Bubble */}
            <AnimatePresence>
              {(isRunning || isExploring || isOrchestrating) && (
                <motion.div 
                  initial={{ opacity: 0, x: 20, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.8 }}
                  className="absolute bottom-full right-0 mb-4 w-64 glass-panel p-3 rounded-2xl text-xs border-emerald-500/20"
                >
                  <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold uppercase tracking-tighter">
                    <Zap className="w-3 h-3" /> JIT Coach
                  </div>
                  <p className="text-gray-300 leading-relaxed">
                    {isRunning ? "Executing system commands. Ensure sandbox isolation is verified." :
                     isExploring ? "Researching external vectors. Cross-referencing multiple sources for accuracy." :
                     "Orchestrating multi-agent workflow. Balancing load across Planner and Executor."}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <div className="h-1 flex-1 bg-emerald-500/20 rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="h-full w-1/2 bg-emerald-500"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      <MusicPlayer />

      {/* LEFT NAV: Mode Switcher */}
      <div className="w-16 bg-[#050505] border-r border-[#222] flex flex-col items-center py-6 gap-6 flex-shrink-0 z-50 glass-panel !bg-black/40">
        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20 mb-4 group cursor-pointer relative">
          <Brain className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        
        <button 
          onClick={() => setMode('agentos')} 
          className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 ${mode === 'agentos' ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-gray-500 hover:text-gray-300'}`} 
          title="AgentOS Core"
        >
          <Terminal className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setMode('chat')} 
          className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 ${mode === 'chat' ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-gray-500 hover:text-gray-300'}`} 
          title="Chat Interface"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setMode('orchestrator')} 
          className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 ${mode === 'orchestrator' ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'text-gray-500 hover:text-gray-300'}`} 
          title="Task Orchestrator"
        >
          <Network className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setMode('explorer')} 
          className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 ${mode === 'explorer' ? 'bg-orange-500/20 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'text-gray-500 hover:text-gray-300'}`} 
          title="Explorer Agent"
        >
          <Globe className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setMode('media')} 
          className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 ${mode === 'media' ? 'bg-pink-500/20 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.2)]' : 'text-gray-500 hover:text-gray-300'}`} 
          title="Media Studio"
        >
          <ImageIcon className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setMode('live')} 
          className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 ${mode === 'live' ? 'bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-gray-500 hover:text-gray-300'}`} 
          title="Live Intelligence"
        >
          <Video className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setMode('github')} 
          className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 ${mode === 'github' ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'text-gray-500 hover:text-gray-300'}`} 
          title="GitHub Agent"
        >
          <Box className="w-6 h-6" />
        </button>
      </div>

      {/* LEFT SIDEBAR: Dynamic based on Mode */}
      <motion.div 
        animate={{ width: leftSidebarCollapsed ? 0 : 256, opacity: leftSidebarCollapsed ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-[#111] border-r border-[#222] flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar glass-panel !bg-black/20 relative"
      >
        <div className="p-4 h-full flex flex-col min-w-[256px]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-emerald-400">
              {mode === 'agentos' && <Terminal className="w-5 h-5" />}
              {mode === 'chat' && <MessageSquare className="w-5 h-5 text-blue-400" />}
              {mode === 'orchestrator' && <Network className="w-5 h-5 text-purple-400" />}
              {mode === 'explorer' && <Globe className="w-5 h-5 text-orange-400" />}
              {mode === 'media' && <ImageIcon className="w-5 h-5 text-pink-400" />}
              {mode === 'live' && <Video className="w-5 h-5 text-red-400" />}
              {mode === 'github' && <Box className="w-5 h-5 text-indigo-400" />}
              <h1 className="font-bold tracking-wider text-sm uppercase metallic-text">
                {mode === 'agentos' ? 'AgentOS Core' : 
                 mode === 'chat' ? 'Conversational' :
                 mode === 'orchestrator' ? 'Orchestration' :
                 mode === 'explorer' ? 'Explorer' :
                 mode === 'media' ? 'Media Studio' : 
                 mode === 'live' ? 'Live Core' : 'GitHub Agent'}
              </h1>
            </div>
            <div className="flex gap-1">
              <button onClick={saveState} className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#222] rounded transition-colors" title="Save State">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => setLeftSidebarCollapsed(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

        {/* AGENTOS SIDEBAR */}
        {mode === 'agentos' && (
          <AgentOSSidebar 
            activeMemories={activeMemories}
            currentDir={currentDir}
            sandboxConfig={sandboxConfig}
            setSandboxConfig={setSandboxConfig}
            plannerStatus={plannerStatus}
            executorStatus={executorStatus}
            reviewerStatus={reviewerStatus}
            sandboxStatus={sandboxStatus}
            envVars={envVars}
            setEnvVars={setEnvVars}
          />
        )}

        {/* CHAT SIDEBAR */}
        {mode === 'chat' && (
          <>
            <div className="mb-8">
              <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
                <User className="w-4 h-4" /> AI Personality
              </h2>
              <div className="glass-panel border-white/5 rounded-2xl p-4 text-[10px] space-y-4 shadow-lg">
                <div>
                  <label className="block text-gray-500 font-bold uppercase tracking-widest text-[8px] mb-2">Current Persona</label>
                  <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/30 text-blue-400 font-bold shadow-inner">
                    Technical Architect
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Tone:</span>
                    <span className="text-gray-300">Professional</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Verbosity:</span>
                    <span className="text-gray-300">Detailed</span>
                  </div>
                </div>
                <button className="w-full py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 font-bold uppercase tracking-widest text-[9px] hover:bg-blue-500/20 transition-all shadow-md">
                  Change Persona
                </button>
              </div>
            </div>
            <div className="mb-8">
              <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
                <Layers className="w-4 h-4" /> Context Window
              </h2>
              <div className="glass-panel border-white/5 rounded-2xl p-4 text-[10px] space-y-4 shadow-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Tokens:</span>
                  <span className="text-emerald-400 font-mono font-bold">12.4k / 1M</span>
                </div>
                <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "1.2%" }}
                    className="bg-emerald-500 h-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                  />
                </div>
                <p className="text-[9px] text-gray-600 italic leading-relaxed">Context includes last 20 messages and active memory vectors.</p>
              </div>
            </div>
          </>
        )}

        {/* ORCHESTRATOR SIDEBAR */}
        {mode === 'orchestrator' && (
          <OrchestratorSidebar tasks={tasks} />
        )}

        {/* EXPLORER SIDEBAR */}
        {mode === 'explorer' && (
          <ExplorerSidebar explorerLogs={explorerLogs} />
        )}

        {/* MEDIA SIDEBAR */}
        {mode === 'media' && (
          <MediaSidebar />
        )}

        {/* LIVE SIDEBAR */}
        {mode === 'live' && (
          <LiveSidebar />
        )}

        {/* GITHUB SIDEBAR */}
        {mode === 'github' && (
          <div className="flex-1 flex flex-col min-w-0 p-6 relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-indigo-400 flex items-center gap-2 metallic-text"><Box className="w-6 h-6" /> GitHub Repository</h2>
            </div>
            <div className="flex-1 glass-panel !bg-black/40 border-white/5 rounded-3xl p-6 flex items-center justify-center text-gray-600">
              <p className="text-sm uppercase tracking-[0.3em]">Repository Content Placeholder</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>

    {/* COLLAPSED SIDEBAR TRIGGER */}
    {leftSidebarCollapsed && (
      <button 
        onClick={() => setLeftSidebarCollapsed(false)}
        className="fixed left-16 top-1/2 -translate-y-1/2 z-40 p-2 bg-emerald-500/20 text-emerald-400 border-y border-r border-emerald-500/30 rounded-r-xl hover:bg-emerald-500/30 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[#050505]">
        {/* TOP BAR */}
        <div className="h-14 border-b border-[#222] flex items-center justify-between px-6 glass-panel !bg-black/40 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
              />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] metallic-text">System Operational</span>
            </div>
            <div className="h-4 w-[1px] bg-[#333]" />
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full glass-panel border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400 font-bold shadow-[0_0_10px_rgba(16,185,129,0.1)]" title="Planner Agent">P</div>
              <div className="w-8 h-8 rounded-full glass-panel border-blue-500/30 flex items-center justify-center text-[10px] text-blue-400 font-bold shadow-[0_0_10px_rgba(59,130,246,0.1)]" title="Executor Agent">E</div>
              <div className="w-8 h-8 rounded-full glass-panel border-purple-500/30 flex items-center justify-center text-[10px] text-purple-400 font-bold shadow-[0_0_10px_rgba(168,85,247,0.1)]" title="Reviewer Agent">R</div>
            </div>
            <button className="p-2 text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"><Maximize2 className="w-4 h-4" /></button>
          </div>
        </div>

        {/* AGENTOS MODE */}
        {mode === 'agentos' && (
          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {logs.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-gray-600 opacity-30"
                  >
                    <Terminal className="w-20 h-20 mb-4 stroke-[1px]" />
                    <p className="text-sm uppercase tracking-[0.3em]">Awaiting Neural Uplink</p>
                  </motion.div>
                ) : (
                  logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      className={`flex gap-4 group ${log.type === 'user' ? 'justify-end' : ''}`}
                    >
                      {log.type !== 'user' && (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 glass-panel border-white/5 shadow-lg ${
                          log.type === 'planner' ? 'text-emerald-400' :
                          log.type === 'executor' ? 'text-blue-400' :
                          log.type === 'reviewer' ? 'text-purple-400' :
                          log.type === 'sandbox' ? 'text-orange-400' :
                          'text-gray-400'
                        }`}>
                          {log.type === 'planner' && <Brain className="w-5 h-5" />}
                          {log.type === 'executor' && <Cpu className="w-5 h-5" />}
                          {log.type === 'reviewer' && <ShieldCheck className="w-5 h-5" />}
                          {log.type === 'sandbox' && <Box className="w-5 h-5" />}
                          {log.type === 'terminal' && <Terminal className="w-5 h-5" />}
                          {log.type === 'system' && <Activity className="w-5 h-5" />}
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm glass-panel border-white/5 shadow-xl ${
                        log.type === 'user' ? 'bg-emerald-500/10 !border-emerald-500/20 text-emerald-100' : 
                        log.type === 'terminal' ? 'bg-black/60 font-mono text-emerald-400 !border-emerald-500/20' :
                        'bg-white/5 text-gray-300'
                      }`}>
                        <div className="flex items-center justify-between mb-2 gap-6">
                          <span className={`text-[10px] uppercase tracking-[0.2em] font-bold opacity-60 ${
                            log.type === 'planner' ? 'text-emerald-400' :
                            log.type === 'executor' ? 'text-blue-400' :
                            log.type === 'reviewer' ? 'text-purple-400' :
                            'text-gray-400'
                          }`}>
                            {log.type}
                          </span>
                          <span className="text-[10px] opacity-30 font-mono">
                            {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <div className={`${log.status === 'error' ? 'text-red-400' : log.status === 'success' ? 'text-emerald-400' : ''}`}>
                          {log.type === 'terminal' ? (
                            <pre className="whitespace-pre-wrap break-all">{log.content}</pre>
                          ) : (
                            <MarkdownRenderer content={log.content} />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
              
              {isRunning && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 text-emerald-500/60 text-[10px] font-bold uppercase tracking-[0.2em] ml-14"
                >
                  <div className="flex gap-1.5">
                    <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }} className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }} className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  </div>
                  <span className="metallic-text">Neural Processing Active</span>
                </motion.div>
              )}
              <div ref={logsEndRef} />
            </div>

            <div className="p-6 pt-0">
              <div className="relative group max-w-4xl mx-auto w-full">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-25 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center glass-panel !bg-black/60 border-white/10 rounded-2xl p-2 shadow-2xl">
                  <div className="pl-4 text-emerald-500/50">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRunCycle()}
                    placeholder={isRunning ? "System busy..." : getPlaceholder()}
                    disabled={isRunning}
                    className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 font-sans"
                  />
                  <button
                    onClick={() => handleRunCycle()}
                    disabled={isRunning || !input.trim()}
                    className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40 group/btn overflow-hidden relative"
                  >
                    <div className="relative z-10">
                      {isRunning ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                    </div>
                    <motion.div 
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {mode === 'chat' && (
        <div className="flex-1 flex flex-col min-w-0 p-6 relative">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2 metallic-text"><MessageSquare className="w-6 h-6" /> Conversational Agent</h2>
            <div className="flex gap-2">
              <div className="px-3 py-1 glass-panel border-blue-500/20 text-[10px] text-blue-400 font-bold uppercase tracking-widest">Neural Link: Active</div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-6 custom-scrollbar pr-2 min-h-0">
            {chatLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-30">
                <MessageSquare className="w-20 h-20 mb-4 stroke-[1px]" />
                <p className="text-sm uppercase tracking-[0.3em]">Awaiting Dialogue</p>
              </div>
            ) : (
              chatLogs.map((log, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${log.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`p-4 rounded-2xl max-w-[80%] glass-panel shadow-xl ${
                    log.role === 'user' 
                      ? 'bg-blue-500/10 !border-blue-500/30 text-blue-100' 
                      : 'bg-white/5 !border-white/10 text-gray-300'
                  }`}>
                    <div className="flex items-center justify-between mb-2 gap-4 opacity-40 text-[10px] font-bold uppercase tracking-widest">
                      <span>{log.role === 'user' ? 'User' : 'AgentOS'}</span>
                      <span className="font-mono">01:22:22</span>
                    </div>
                    {log.role === 'user' ? log.text : <MarkdownRenderer content={log.text} />}
                  </div>
                </motion.div>
              ))
            )}
          </div>
          
          <div className="relative group max-w-4xl mx-auto w-full">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl blur opacity-25 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center glass-panel !bg-black/60 border-white/10 rounded-2xl p-2 shadow-2xl">
              <input 
                type="text" 
                id="chatInput" 
                placeholder="Synchronize neural patterns..." 
                className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 font-sans" 
                onKeyDown={(e) => { 
                  if (e.key === 'Enter') { 
                    handleChatSubmit(e.currentTarget.value); 
                    e.currentTarget.value = ''; 
                  } 
                }} 
              />
              <button className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-400 transition-all shadow-lg shadow-blue-900/40">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'media' && (
        <div className="flex-1 flex flex-col min-w-0 p-6 items-center justify-center relative">
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-pink-400 flex items-center gap-2 metallic-text"><ImageIcon className="w-6 h-6" /> Media Studio</h2>
            <div className="flex gap-2">
              <div className="px-3 py-1 glass-panel border-pink-500/20 text-[10px] text-pink-400 font-bold uppercase tracking-widest">Engine: Imagen 4.0</div>
            </div>
          </div>

          <div className="w-full max-w-2xl flex flex-col items-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full aspect-video glass-panel !bg-black/40 border-white/5 rounded-3xl flex items-center justify-center text-gray-600 mb-12 shadow-2xl overflow-hidden relative group"
            >
              {mediaUrl ? (
                mediaType === "image" ? (
                  <img src={mediaUrl} alt="Generated" className="w-full h-full object-contain" />
                ) : (
                  <video src={mediaUrl} controls autoPlay loop className="w-full h-full object-contain" />
                )
              ) : (
                <div className="flex flex-col items-center gap-4 opacity-30">
                  {isGeneratingMedia ? (
                    <>
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 border-t-2 border-pink-500 rounded-full"
                      />
                      <p className="text-sm uppercase tracking-[0.3em]">{mediaType === "video" ? "Synthesizing Motion..." : "Rendering Vision..."}</p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-20 h-20 stroke-[1px]" />
                      <p className="text-sm uppercase tracking-[0.3em]">Awaiting Prompt</p>
                    </>
                  )}
                </div>
              )}
              
              {mediaUrl && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl glass-panel border-white/20 transition-all"><Download className="w-6 h-6 text-white" /></button>
                  <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl glass-panel border-white/20 transition-all"><Share2 className="w-6 h-6 text-white" /></button>
                </div>
              )}
            </motion.div>

            <div className="w-full max-w-xl relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl blur opacity-25 group-focus-within:opacity-100 transition-opacity duration-500" />
              <div className="relative flex flex-col glass-panel !bg-black/60 border-white/10 rounded-2xl p-2 shadow-2xl">
                <input 
                  type="text" 
                  id="mediaInput" 
                  placeholder="Describe your vision..." 
                  disabled={isGeneratingMedia} 
                  className="w-full bg-transparent border-none focus:ring-0 px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 font-sans disabled:opacity-50" 
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') { 
                      handleMediaGenerate(e.currentTarget.value, 'image'); 
                      e.currentTarget.value = ''; 
                    } 
                  }} 
                />
                <div className="flex gap-2 p-2 border-t border-white/5 mt-2">
                  <button 
                    disabled={isGeneratingMedia}
                    onClick={() => {
                      const input = document.getElementById('mediaInput') as HTMLInputElement;
                      handleMediaGenerate(input.value, 'image');
                      input.value = '';
                    }}
                    className="flex-1 py-2.5 bg-pink-500/10 border border-pink-500/30 rounded-xl text-pink-400 hover:bg-pink-500/20 transition-all text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                  >
                    Generate Image
                  </button>
                  <button 
                    disabled={isGeneratingMedia}
                    onClick={() => {
                      const input = document.getElementById('mediaInput') as HTMLInputElement;
                      handleMediaGenerate(input.value, 'video');
                      input.value = '';
                    }}
                    className="flex-1 py-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 hover:bg-purple-500/20 transition-all text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                  >
                    Generate Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'orchestrator' && (
        <div className="flex-1 flex flex-col min-w-0 p-6 relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2 metallic-text"><Network className="w-6 h-6" /> Task Orchestrator</h2>
              <div className="flex glass-panel !bg-black/60 p-1 border-white/10 rounded-xl">
                <button 
                  onClick={() => setBoardGrouping('status')}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${boardGrouping === 'status' ? 'bg-purple-500/20 text-purple-400 shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}
                  title="Group by Status (Todo, In Progress, Done)"
                >
                  Status
                </button>
                <button 
                  onClick={() => setBoardGrouping('priority')}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${boardGrouping === 'priority' ? 'bg-purple-500/20 text-purple-400 shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}
                  title="Group by Priority (High, Medium, Low)"
                >
                  Priority
                </button>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <TaskDependencyGraph tasks={tasks} />
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-purple-500/20 rounded-xl blur opacity-25 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center glass-panel !bg-black/60 border-white/10 rounded-xl px-3 py-1.5">
                  <Search className="w-3.5 h-3.5 text-gray-500 mr-2" />
                  <input
                    type="text"
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="bg-transparent border-none focus:ring-0 text-[10px] text-gray-200 placeholder:text-gray-600 w-32 md:w-48"
                  />
                </div>
              </div>
              <div className="px-3 py-1 glass-panel border-purple-500/20 text-[10px] text-purple-400 font-bold uppercase tracking-widest">Active Threads: {tasks.filter(t => t.status === 'in-progress').length}</div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            {/* Kanban Board Section */}
            <div className="flex-1 flex flex-col glass-panel !bg-black/40 border-white/5 rounded-3xl p-6 overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-6">
                  <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 uppercase tracking-widest">
                    <CheckCircle2 className="w-4 h-4 text-purple-400" /> Task Board
                  </h3>
                  <div className="flex glass-panel !bg-black/60 p-1 border-white/10 rounded-xl">
                    <button 
                      onClick={() => setOrchestratorView('board')}
                      className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${orchestratorView === 'board' ? 'bg-purple-500/20 text-purple-400 shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Board
                    </button>
                    <button 
                      onClick={() => setOrchestratorView('calendar')}
                      className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${orchestratorView === 'calendar' ? 'bg-purple-500/20 text-purple-400 shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Calendar
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64 group">
                    <div className="absolute -inset-0.5 bg-purple-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <input
                      type="text"
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTask()}
                      placeholder="Add manual task..."
                      className="relative w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                  <button 
                    onClick={addTask} 
                    className="bg-purple-500 text-white hover:bg-purple-400 px-4 py-2 rounded-xl transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:scale-105 active:scale-95"
                    title="Create new task"
                  >
                    Add
                  </button>
                  <button 
                    onClick={() => {
                      const name = prompt("Enter template name:");
                      if (name) {
                        setTaskTemplates([...taskTemplates, { name, task: { text: newTaskText, priority: 'medium' } }]);
                        addLog("system", `Template '${name}' saved.`, "success");
                      }
                    }}
                    className="p-2 glass-panel border-purple-500/20 text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all hover:scale-105 active:scale-95"
                    title="Save current input as template"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  {taskTemplates.length > 0 && (
                    <div className="relative group/templates">
                      <button className="p-2 glass-panel border-purple-500/20 text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all hover:scale-105 active:scale-95">
                        <Layers className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-full mt-2 w-48 glass-panel !bg-black/90 border-white/10 rounded-xl p-2 shadow-2xl opacity-0 invisible group-hover/templates:opacity-100 group-hover/templates:visible transition-all z-50">
                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 px-2">Templates</div>
                        {taskTemplates.map((tmpl, i) => (
                          <button
                            key={i}
                            onClick={() => setNewTaskText(tmpl.task.text || "")}
                            className="w-full text-left px-2 py-1.5 text-[10px] text-gray-300 hover:bg-white/5 rounded-lg transition-colors truncate"
                          >
                            {tmpl.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {orchestratorView === 'board' ? (
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
                    {(boardGrouping === 'status' ? (['todo', 'in-progress', 'done'] as const) : (['high', 'medium', 'low'] as const)).map(group => (
                      <div key={group} className="flex-1 min-w-[320px] flex flex-col glass-panel !bg-black/20 border-white/5 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/5 font-bold text-[10px] text-gray-500 uppercase tracking-[0.2em] flex justify-between items-center bg-white/5">
                          {group.replace('-', ' ')}
                          <span className="bg-black/40 text-purple-400 py-0.5 px-2.5 rounded-full border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                            {tasks.filter(t => (boardGrouping === 'status' ? t.status === group : t.priority === group) && (t.text.toLowerCase().includes(taskSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(taskSearchQuery.toLowerCase()))).length}
                          </span>
                        </div>
                        <Droppable droppableId={group}>
                          {(provided) => (
                            <div 
                              ref={provided.innerRef} 
                              {...provided.droppableProps}
                              className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar"
                            >
                              {tasks
                                .filter(t => (boardGrouping === 'status' ? t.status === group : t.priority === group) && (t.text.toLowerCase().includes(taskSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(taskSearchQuery.toLowerCase())))
                                .map((task, index) => (
                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                  {(provided) => (
                                    <motion.div
                                      layout
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      whileHover={{ scale: 1.02, y: -2 }}
                                      className="glass-panel !bg-black/60 border-white/10 rounded-xl p-4 group hover:border-purple-500/30 transition-all shadow-lg"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div {...provided.dragHandleProps} className="mt-1 text-gray-600 hover:text-purple-400 cursor-grab transition-colors" title="Drag to reorder or change group">
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between mb-2">
                                            <input
                                              type="text"
                                              value={task.text}
                                              onChange={(e) => updateTaskField(task.id, 'text', e.target.value)}
                                              className={`bg-transparent border-none focus:ring-0 p-0 text-sm font-medium w-full ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-200'}`}
                                            />
                                            <div className="flex items-center gap-2 ml-2">
                                              <span className="text-[8px] text-gray-600 font-mono uppercase">ID:</span>
                                              <input
                                                type="text"
                                                value={task.id}
                                                onChange={(e) => updateTaskField(task.id, 'id', e.target.value)}
                                                className="bg-black/40 border border-white/5 rounded px-1.5 py-0.5 text-[9px] text-gray-500 font-mono w-16 focus:border-purple-500/50 outline-none"
                                                title="Custom Task ID"
                                              />
                                            </div>
                                          </div>
                                          
                                          <div className="flex flex-wrap gap-2 mt-3 items-center">
                                            <select 
                                              value={task.priority} 
                                              onChange={(e) => updateTaskField(task.id, 'priority', e.target.value)}
                                              className={`text-[10px] font-bold uppercase tracking-widest bg-black/40 border border-white/10 rounded-lg px-2 py-1 outline-none transition-all ${
                                                task.priority === 'high' ? 'text-red-400 border-red-500/20' : 
                                                task.priority === 'medium' ? 'text-orange-400 border-orange-500/20' : 'text-blue-400 border-blue-500/20'
                                              }`}
                                              title="Task Priority"
                                            >
                                              <option value="low">Low</option>
                                              <option value="medium">Med</option>
                                              <option value="high">High</option>
                                            </select>

                                            <select
                                              value={task.assignedAgent || ''}
                                              onChange={(e) => updateTaskField(task.id, 'assignedAgent', e.target.value || undefined)}
                                              className="text-[10px] font-bold uppercase tracking-widest bg-black/40 border border-white/10 rounded-lg px-2 py-1 outline-none text-purple-400 border-purple-500/20"
                                              title="Assigned Agent"
                                            >
                                              <option value="">No Agent</option>
                                              <option value="agentos">AgentOS</option>
                                              <option value="explorer">Explorer</option>
                                              <option value="chat">Chat</option>
                                              <option value="media">Media</option>
                                            </select>

                                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-black/40 border border-white/10 rounded-lg px-2 py-1" title="Due Date">
                                              <CalendarIcon className="w-3 h-3" />
                                              <input 
                                                type="date" 
                                                value={task.dueDate || ''} 
                                                onChange={(e) => updateTaskField(task.id, 'dueDate', e.target.value)}
                                                className="bg-transparent outline-none w-[85px] cursor-pointer"
                                              />
                                            </div>
                                          </div>

                                          {tasks.length > 1 && (
                                            <div className="mt-3">
                                              <select
                                                onChange={(e) => {
                                                  if (e.target.value && !task.dependencies.includes(e.target.value)) {
                                                    updateTaskField(task.id, 'dependencies', [...task.dependencies, e.target.value]);
                                                  }
                                                }}
                                                value=""
                                                className="text-[10px] font-bold uppercase tracking-widest bg-black/40 border border-white/10 rounded-lg px-2 py-1 outline-none text-gray-500 w-full hover:border-white/20 transition-all"
                                                title="Add dependency"
                                              >
                                                <option value="">+ Add Dependency</option>
                                                {tasks.filter(t => t.id !== task.id && !task.dependencies.includes(t.id)).map(t => (
                                                  <option key={t.id} value={t.id}>{t.text.substring(0, 30)}...</option>
                                                ))}
                                              </select>
                                              {task.dependencies.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                  {task.dependencies.map(depId => {
                                                    const depTask = tasks.find(t => t.id === depId);
                                                    return depTask ? (
                                                      <span key={depId} className="text-[9px] font-bold uppercase tracking-tighter bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-lg border border-purple-500/20 flex items-center gap-1.5" title={`Depends on: ${depTask.text}`}>
                                                        <Network className="w-2 h-2" />
                                                        {depTask.id}
                                                        <button onClick={() => updateTaskField(task.id, 'dependencies', task.dependencies.filter(d => d !== depId))} className="hover:text-red-400 transition-colors" title="Remove dependency"><XCircle className="w-3 h-3" /></button>
                                                      </span>
                                                    ) : null;
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        
                                        <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                          <button onClick={() => pipelineTask(task)} className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/20 transition-all hover:scale-110 active:scale-90" title="Run Task">
                                            <PlayCircle className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => deleteTask(task.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-all hover:scale-110 active:scale-90" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    ))}
                  </div>
                </DragDropContext>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="p-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 glass-panel !bg-black/40 border-white/5 rounded-xl">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => {
                      const date = new Date();
                      date.setDate(date.getDate() + i - date.getDay());
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const dayTasks = tasks.filter(t => t.dueDate === dateStr && (t.text.toLowerCase().includes(taskSearchQuery.toLowerCase()) || t.id.toLowerCase().includes(taskSearchQuery.toLowerCase())));
                      const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      return (
                        <motion.div 
                          key={i} 
                          whileHover={{ scale: 1.02, zIndex: 10 }}
                          className={`min-h-[120px] p-3 glass-panel !bg-black/20 border-white/5 rounded-2xl transition-all hover:!bg-black/40 group ${isToday ? '!border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : ''}`}
                        >
                          <div className={`text-xs font-bold mb-2 ${isToday ? 'text-purple-400' : 'text-gray-600'}`}>
                            {format(date, 'd')}
                          </div>
                          <div className="space-y-1.5">
                            {dayTasks.map(task => (
                              <div key={task.id} className={`text-[9px] font-bold uppercase p-1.5 rounded-lg border truncate transition-all ${task.status === 'done' ? 'bg-black/40 text-gray-600 border-white/5 line-through' : 'bg-purple-500/10 text-purple-300 border-purple-500/20'}`}>
                                {task.text}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Orchestrator AI Section */}
            <div className="h-64 flex flex-col glass-panel !bg-black/40 border-white/5 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2 uppercase tracking-widest">
                <Brain className="w-4 h-4 text-purple-400" /> AI Orchestration Logs
              </h3>
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 custom-scrollbar pr-2">
                {orchestratorLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-30">
                    <Network className="w-12 h-12 mb-4 stroke-[1px]" />
                    <p className="text-center text-xs uppercase tracking-widest">Awaiting Objective Breakdown</p>
                  </div>
                ) : (
                  orchestratorLogs.map((log, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass-panel !bg-black/60 border-white/10 rounded-xl p-4"
                    >
                      <h4 className="text-purple-400 font-bold mb-2 text-xs uppercase tracking-widest">Goal: {log.task}</h4>
                      <ul className="list-disc list-inside text-gray-400 space-y-1.5 text-xs">
                        {log.subtasks.map((st, j) => (
                          <li key={j} className="markdown-inline"><MarkdownRenderer content={st} /></li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-2 mt-3 text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Tasks Injected into Board</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-purple-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <input 
                  type="text" 
                  id="orchestratorInput" 
                  placeholder="Enter complex goal to orchestrate..." 
                  disabled={isOrchestrating} 
                  className="relative w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 transition-all disabled:opacity-50" 
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleOrchestratorSubmit(e.currentTarget.value); e.currentTarget.value = ''; } }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'explorer' && (
        <div className="flex-1 flex flex-col min-w-0 p-6 relative">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-orange-400 flex items-center gap-2 metallic-text"><Globe className="w-6 h-6" /> Explorer Sub-Agent</h2>
            <div className="flex gap-2">
              <div className="px-3 py-1 glass-panel border-orange-500/20 text-[10px] text-orange-400 font-bold uppercase tracking-widest">Status: Scanning Web</div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-6 mb-6 custom-scrollbar pr-2">
            {explorerLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-30">
                <Globe className="w-20 h-20 mb-4 stroke-[1px]" />
                <p className="text-sm uppercase tracking-[0.3em]">Awaiting Research Objective</p>
              </div>
            ) : (
              explorerLogs.map((log, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel !bg-black/40 border-white/5 rounded-3xl p-6 shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg glass-panel border-orange-500/20 flex items-center justify-center text-orange-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <h3 className="text-orange-300 font-bold text-sm uppercase tracking-widest">Query: {log.query}</h3>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed"><MarkdownRenderer content={log.result} /></div>
                </motion.div>
              ))
            )}
          </div>
          
          <div className="relative group max-w-4xl mx-auto w-full">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-2xl blur opacity-25 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center glass-panel !bg-black/60 border-white/10 rounded-2xl p-2 shadow-2xl">
              <input 
                type="text" 
                id="explorerInput" 
                placeholder="Initiate research query..." 
                disabled={isExploring} 
                className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 font-sans disabled:opacity-50" 
                onKeyDown={(e) => { 
                  if (e.key === 'Enter') { 
                    handleExplorerSubmit(e.currentTarget.value); 
                    e.currentTarget.value = ''; 
                  } 
                }} 
              />
              <button className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-400 transition-all shadow-lg shadow-orange-900/40">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'live' && (
        <div className="flex-1 flex flex-col min-w-0 p-6 items-center justify-center relative">
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 h-full max-h-[80vh] relative z-10">
            {/* Main Video Area */}
            <div className="md:col-span-2 flex flex-col gap-4">
              <div className="w-full aspect-video glass-panel border-white/10 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                
                {liveStatus === "Offline" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                      <Video className="w-10 h-10 text-red-500/40" />
                    </div>
                    <p className="text-gray-400 font-medium tracking-widest uppercase text-xs">Camera Offline</p>
                  </div>
                )}

                {/* Transcription Overlay */}
                <div className="absolute bottom-16 left-4 right-4 z-20 pointer-events-none">
                  <div className="flex flex-col gap-2">
                    {liveTranscripts.map((t, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`px-4 py-2 rounded-2xl text-sm max-w-[80%] backdrop-blur-md border ${
                          t.role === 'user' 
                            ? 'bg-blue-500/20 border-blue-500/30 text-blue-100 self-end' 
                            : 'bg-white/5 border-white/10 text-gray-200 self-start'
                        }`}
                      >
                        {t.text}
                      </motion.div>
                    ))}
                  </div>
                </div>
                
                <div className="absolute bottom-4 left-4 flex gap-4 z-20">
                  <div className="glass-panel !bg-black/40 px-4 py-2 rounded-full text-xs text-gray-300 border-white/10 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${liveStatus === 'Connected' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-600'}`} />
                    <span className={liveStatus === 'Connected' ? 'text-emerald-400 font-bold' : 'text-gray-500'}>{liveStatus}</span>
                  </div>
                  {liveStatus === 'Connected' && (
                    <button 
                      onClick={toggleScreenShare}
                      className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${
                        isScreenSharing 
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' 
                          : 'glass-panel !bg-black/40 border-white/10 text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                <button 
                  onClick={toggleLiveChat}
                  className={`px-10 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-2xl border ${
                    liveStatus === "Offline" || liveStatus.startsWith("Error")
                      ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-red-600/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                  }`}
                >
                  {liveStatus === "Offline" || liveStatus.startsWith("Error") ? "Initialize Live Stream" : "Terminate Session"}
                </button>
              </div>
            </div>

            {/* Side Intelligence Log */}
            <div className="glass-panel border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-widest">
                <Activity className="w-4 h-4" />
                Intelligence Log
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {liveLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50 text-center p-4">
                    <motion.div
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Cpu className="w-12 h-12 mb-4" />
                    </motion.div>
                    <p className="text-[10px] italic uppercase tracking-widest">Awaiting stream data...</p>
                  </div>
                ) : (
                  liveLogs.map((log, i) => (
                    <div key={i} className={`p-3 rounded-xl border text-[10px] font-mono ${
                      log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      log.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                      <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                      {log.message}
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 bg-black/40 border-t border-white/10">
                <p className="text-[10px] text-gray-500 text-center italic leading-relaxed">
                  Autonomous monitoring active. The core is analyzing multimodal inputs for real-time tasking.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* RIGHT SIDEBAR: Tripartite Minds */}
      {mode === 'agentos' && (
        <div className="w-full md:w-80 glass-panel border-l border-white/10 flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar relative z-10">
          <div className="p-6 border-b border-white/10 sticky top-0 bg-black/60 backdrop-blur-xl z-20">
            <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold flex items-center gap-2 metallic-text">
              <Brain className="w-4 h-4" /> Tripartite Minds
            </h2>
          </div>

          <div className="p-6 space-y-8">
            {/* Planner Panel */}
            <AgentPanel
              title="Strategic Planner"
              icon={<Brain className="w-4 h-4 text-purple-400" />}
              status={plannerStatus}
              color="border-purple-500/50"
              extraLogs={
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Reasoning Depth:</span> <span className="text-purple-400">High</span></div>
                  <div className="flex justify-between"><span>Context Window:</span> <span className="text-purple-400">128k</span></div>
                  <div className="flex justify-between"><span>Last Decision:</span> <span className="text-purple-400">Branching Logic Alpha</span></div>
                </div>
              }
            >
              {plannerData ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-purple-400/80 font-bold uppercase tracking-widest text-[9px] block mb-2">Analysis:</span>
                    <p className="text-gray-300 leading-relaxed">{plannerData.analysis}</p>
                  </div>
                  <div>
                    <span className="text-purple-400/80 font-bold uppercase tracking-widest text-[9px] block mb-2">Blueprint:</span>
                    <ul className="space-y-2">
                      {plannerData.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-400">
                          <span className="text-purple-500 font-mono">{i + 1}.</span>
                          <span className="leading-tight">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <span className="text-purple-400/80 font-bold uppercase tracking-widest text-[9px] block mb-1">Risk Assessment:</span>
                    <p className="text-gray-500 italic">{plannerData.risk}</p>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center opacity-30">
                  <Brain className="w-8 h-8 mb-2 text-gray-600" />
                  <p className="text-[10px] uppercase tracking-widest">Awaiting Input</p>
                </div>
              )}
            </AgentPanel>

            {/* Executor Panel */}
            <AgentPanel
              title="Terminal Executor"
              icon={<Terminal className="w-4 h-4 text-orange-400" />}
              status={executorStatus}
              color="border-orange-500/50"
              extraLogs={
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Process ID:</span> <span className="text-orange-400">8829</span></div>
                  <div className="flex justify-between"><span>Memory Usage:</span> <span className="text-orange-400">42.1 MB</span></div>
                  <div className="flex justify-between"><span>Active Streams:</span> <span className="text-orange-400">3</span></div>
                </div>
              }
            >
              {executorData ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-orange-400/80 font-bold uppercase tracking-widest text-[9px] block mb-2">Logic:</span>
                    <p className="text-gray-300 leading-relaxed">{executorData.logic}</p>
                  </div>
                  <div>
                    <span className="text-orange-400/80 font-bold uppercase tracking-widest text-[9px] block mb-2">Command:</span>
                    <div className="relative group">
                      <code className="block bg-black/60 p-3 rounded-xl border border-white/10 text-emerald-400 font-mono break-all leading-relaxed">
                        {executorData.command}
                      </code>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Copy className="w-3 h-3 text-gray-500 cursor-pointer hover:text-emerald-400" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center opacity-30">
                  <Terminal className="w-8 h-8 mb-2 text-gray-600" />
                  <p className="text-[10px] uppercase tracking-widest">Awaiting Logic</p>
                </div>
              )}
            </AgentPanel>

            {/* Reviewer Panel */}
            <AgentPanel
              title="Security Auditor"
              icon={<ShieldCheck className="w-4 h-4 text-cyan-400" />}
              status={reviewerStatus}
              color="border-cyan-500/50"
              extraLogs={
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Threat Level:</span> <span className="text-emerald-400">Low</span></div>
                  <div className="flex justify-between"><span>Policy Compliance:</span> <span className="text-cyan-400">100%</span></div>
                  <div className="flex justify-between"><span>Last Audit:</span> <span className="text-cyan-400">0.4s ago</span></div>
                </div>
              }
            >
              {reviewerData ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-cyan-400/80 font-bold uppercase tracking-widest text-[9px] block mb-2">Audit Log:</span>
                    <p className="text-gray-300 leading-relaxed">{reviewerData.audit}</p>
                  </div>
                  <div>
                    <span className="text-cyan-400/80 font-bold uppercase tracking-widest text-[9px] block mb-2">Verdict:</span>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold border ${
                        reviewerData.verdict === "APPROVED"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : reviewerData.verdict === "REQUIRES_USER_CONSENT"
                            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                            : "bg-red-500/10 border-red-500/30 text-red-400"
                      }`}
                    >
                      {reviewerData.verdict === "APPROVED" && <CheckCircle2 className="w-4 h-4" />}
                      {reviewerData.verdict === "REQUIRES_USER_CONSENT" && <AlertTriangle className="w-4 h-4" />}
                      {reviewerData.verdict === "REJECTED" && <XCircle className="w-4 h-4" />}
                      <span className="tracking-widest uppercase text-[10px]">{reviewerData.verdict}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center opacity-30">
                  <ShieldCheck className="w-8 h-8 mb-2 text-gray-600" />
                  <p className="text-[10px] uppercase tracking-widest">Awaiting Audit</p>
                </div>
              )}
            </AgentPanel>

            {/* Sandbox Panel */}
            <AgentPanel
              title="Docker Sandbox"
              icon={<Box className="w-4 h-4 text-blue-400" />}
              status={sandboxStatus}
              color="border-blue-500/50"
              extraLogs={
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Container ID:</span> <span className="text-blue-400">ae92-f12</span></div>
                  <div className="flex justify-between"><span>Network Isolation:</span> <span className="text-emerald-400">Enabled</span></div>
                  <div className="flex justify-between"><span>Runtime:</span> <span className="text-blue-400">Node.js 20</span></div>
                </div>
              }
            >
              {sandboxData ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="text-blue-400/80 font-bold uppercase tracking-widest text-[8px] block mb-1">ID:</span>
                      <p className="text-gray-400 font-mono truncate">{sandboxData.containerId}</p>
                    </div>
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="text-blue-400/80 font-bold uppercase tracking-widest text-[8px] block mb-1">Image:</span>
                      <p className="text-gray-400 font-mono truncate">{sandboxData.image}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-blue-400/80 font-bold uppercase tracking-widest text-[9px] block mb-2">Test Output:</span>
                    <code className="block bg-black/60 p-3 rounded-xl border border-white/10 text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                      {sandboxData.output}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400/80 font-bold uppercase tracking-widest text-[9px]">Exit Code:</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold font-mono">
                      {sandboxData.exitCode}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center opacity-30">
                  <Box className="w-8 h-8 mb-2 text-gray-600" />
                  <p className="text-[10px] uppercase tracking-widest">Awaiting Execution</p>
                </div>
              )}
            </AgentPanel>
          </div>
        </div>
      )}

      {/* PERSISTENT EXPLORER WIDGET */}
      <div className={`fixed top-0 right-0 h-full z-50 transition-all duration-300 ease-in-out ${isExplorerWidgetOpen ? 'w-80' : 'w-0'}`}>
        <div className={`h-full glass-panel border-l border-white/10 flex flex-col shadow-2xl relative ${!isExplorerWidgetOpen && 'invisible'}`}>
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/60 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-orange-400 font-bold text-[10px] uppercase tracking-[0.3em] metallic-text">
              <Globe className="w-4 h-4" />
              <span>Explorer Core</span>
            </div>
            <button onClick={() => setIsExplorerWidgetOpen(false)} className="text-gray-500 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/40">
            {explorerLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50 text-center p-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Search className="w-16 h-16 mb-4" />
                </motion.div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Autonomous Research Active</p>
                <p className="text-[9px] mt-2 italic">Monitoring system state for contextual intelligence.</p>
              </div>
            ) : (
              explorerLogs.map((log, i) => (
                <div key={i} className="glass-panel border-white/5 rounded-2xl p-4 text-xs shadow-lg hover:border-orange-500/30 transition-colors">
                  <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                    <Search className="w-3 h-3" />
                    {log.query}
                  </h4>
                  <div className="text-gray-400 text-[10px] leading-relaxed line-clamp-3">
                    {log.result || "Processing research results..."}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Toggle Button when closed */}
        {!isExplorerWidgetOpen && (
          <button 
            onClick={() => setIsExplorerWidgetOpen(true)}
            className="fixed top-1/2 right-0 -translate-y-1/2 bg-black/60 backdrop-blur-xl border border-white/10 border-r-0 p-2 rounded-l-xl text-orange-400 hover:text-orange-300 shadow-xl z-50 transition-all"
            title="Open Explorer Widget"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({
  label,
  status,
}: {
  label: string;
  status: AgentStatus;
}) {
  return (
    <div className="flex items-center justify-between glass-panel border-white/5 p-3 rounded-2xl shadow-md">
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[8px] text-gray-500 uppercase tracking-widest font-mono">{status}</span>
        <motion.div
          className={`w-2 h-2 rounded-full ${
            status === "idle"
              ? "bg-gray-600"
              : status === "working"
                ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                : status === "done"
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          }`}
          initial={false}
          animate={
            status === "working"
              ? { 
                  scale: [1, 1.2, 1], 
                  opacity: [0.6, 1, 0.6], 
                  boxShadow: ["0px 0px 0px rgba(59, 130, 246, 0)", "0px 0px 8px rgba(59, 130, 246, 0.8)", "0px 0px 0px rgba(59, 130, 246, 0)"] 
                }
              : status === "done"
                ? { 
                    scale: [1, 1.5, 1], 
                    boxShadow: ["0px 0px 0px rgba(16, 185, 129, 0)", "0px 0px 12px rgba(16, 185, 129, 1)", "0px 0px 0px rgba(16, 185, 129, 0)"] 
                  }
                : { scale: 1, opacity: 1, boxShadow: "0px 0px 0px rgba(0,0,0,0)" }
          }
          transition={
            status === "working"
              ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
              : status === "done"
                ? { duration: 0.5, ease: "easeOut" }
                : { duration: 0.2 }
          }
        />
      </div>
    </div>
  );
}

function AgentPanel({
  title,
  icon,
  status,
  color,
  children,
  extraLogs,
}: {
  title: string;
  icon: ReactNode;
  status: AgentStatus;
  color: string;
  children: ReactNode;
  extraLogs?: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`glass-panel border-white/10 rounded-2xl overflow-hidden transition-all duration-500 shadow-xl ${
        status === "working" ? `!border-${color.split('-')[1]}-500/50 shadow-${color.split('-')[1]}-500/10` : ""
      } ${isExpanded ? 'row-span-2' : ''}`}
    >
      <div className="bg-white/5 p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3 font-bold text-[10px] uppercase tracking-[0.2em] text-gray-200">
          <div className={`p-1.5 rounded-lg bg-black/40 border border-white/5`}>
            {icon}
          </div>
          {title}
        </div>
        <div className="flex items-center gap-2">
          {status === "working" && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-[8px] text-emerald-400 font-bold animate-pulse">PROCESSING</span>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-3 h-3 border-2 border-t-transparent border-emerald-500 rounded-full"
              />
            </div>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            title={isExpanded ? "Collapse Details" : "View Details"}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className="p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={status === "idle" ? "idle" : "content"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children}
            {isExpanded && extraLogs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 pt-4 border-t border-white/10 text-[10px] text-gray-400 font-mono space-y-2"
              >
                <div className="text-gray-500 uppercase tracking-widest mb-2">Extended Telemetry</div>
                {extraLogs}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
