import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { TASKS } from "../lib/constants";
import type {
  Client, Profile, Project, ProjectInput, ProjectTask, ScheduleEntry, TaskName, TimeLog,
} from "../lib/types";

/* ------------------------------ queries ------------------------------ */

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });
}

const PROJECT_SELECT = `
  id, name, client_id, status, estimated_hours, start_date, client_review_date,
  closed_date, video_minutes, color, archived,
  project_users ( user_id ),
  project_tasks ( id, name, done, task_assignees ( user_id ), subtasks ( id, title, assignee_id, done, created_by ) )
`;

function assembleProject(row: any): Project {
  const tasks = {} as Record<TaskName, ProjectTask>;
  TASKS.forEach((name) => {
    const pt = (row.project_tasks ?? []).find((t: any) => t.name === name);
    tasks[name] = pt
      ? {
          id: pt.id,
          done: pt.done,
          assignees: (pt.task_assignees ?? []).map((a: any) => a.user_id),
          subtasks: (pt.subtasks ?? []).map((s: any) => ({
            id: s.id, title: s.title, assignee: s.assignee_id, done: s.done, created_by: s.created_by,
          })),
        }
      : { id: "", done: false, assignees: [], subtasks: [] };
  });
  return {
    id: row.id, name: row.name, client_id: row.client_id, status: row.status,
    estimated_hours: Number(row.estimated_hours ?? 0),
    start_date: row.start_date, client_review_date: row.client_review_date,
    closed_date: row.closed_date,
    video_minutes: row.video_minutes == null ? null : Number(row.video_minutes),
    color: row.color, archived: row.archived,
    users: (row.project_users ?? []).map((u: any) => u.user_id),
    tasks,
  };
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).order("created_at");
      if (error) throw error;
      return (data ?? []).map(assembleProject);
    },
  });
}

export function useTimeLogs() {
  return useQuery({
    queryKey: ["time_logs"],
    queryFn: async (): Promise<TimeLog[]> => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("id, project_id, user_id, task, hours, log_date, notes")
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((l: any) => ({ ...l, hours: Number(l.hours) })) as TimeLog[];
    },
  });
}

export function useSchedule() {
  return useQuery({
    queryKey: ["schedule"],
    queryFn: async (): Promise<ScheduleEntry[]> => {
      const { data, error } = await supabase
        .from("schedule_entries")
        .select("id, project_id, activity, user_id, task, start_date, end_date, hours, notes");
      if (error) throw error;
      return (data ?? []).map((s: any) => ({ ...s, hours: Number(s.hours) })) as ScheduleEntry[];
    },
  });
}

// Label-only client list (id, name) readable by ALL signed-in users via the
// client_directory view — so artists can show client names on projects they're assigned to.
export function useClientDirectory() {
  return useQuery({
    queryKey: ["client_directory"],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase
        .from("client_directory")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

// Label-only project list (id, name, colour) readable by ALL signed-in users via the
// project_directory view — used by the shared scheduler so every bar can show its project
// name, even for projects the current user isn't assigned to.
export function useProjectDirectory() {
  return useQuery({
    queryKey: ["project_directory"],
    queryFn: async (): Promise<{ id: string; name: string; color: string | null; archived: boolean; client_name: string | null }[]> => {
      const { data, error } = await supabase
        .from("project_directory")
        .select("id, name, color, archived, client_name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

/* ------------------------------ helpers ------------------------------ */

// Map a project's task names to their project_tasks.id (needed when assigning).
async function taskIdsByName(projectId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("project_tasks")
    .select("id, name")
    .eq("project_id", projectId);
  if (error) throw error;
  const m: Record<string, string> = {};
  (data ?? []).forEach((t: any) => (m[t.name] = t.id));
  return m;
}

/* ------------------------------ mutations ------------------------------ */

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useProjectMutations() {
  const invalidate = useInvalidate();

  const create = useMutation({
    mutationFn: async (input: ProjectInput) => {
      const { data: proj, error } = await supabase
        .from("projects")
        .insert({
          name: input.name, client_id: input.client_id, status: input.status,
          estimated_hours: input.estimated_hours, start_date: input.start_date,
          client_review_date: input.client_review_date, closed_date: input.closed_date,
          video_minutes: input.video_minutes, color: input.color,
        })
        .select("id")
        .single();
      if (error) throw error;
      const pid = proj!.id as string;
      if (input.users.length) {
        const { error: e2 } = await supabase
          .from("project_users")
          .insert(input.users.map((user_id) => ({ project_id: pid, user_id })));
        if (e2) throw e2;
      }
      // tasks were auto-seeded by trigger; now apply assignees
      const ids = await taskIdsByName(pid);
      const rows: { project_task_id: string; user_id: string }[] = [];
      TASKS.forEach((t) => (input.taskAssignees[t] ?? []).forEach((uid) =>
        rows.push({ project_task_id: ids[t], user_id: uid })));
      if (rows.length) {
        const { error: e3 } = await supabase.from("task_assignees").insert(rows);
        if (e3) throw e3;
      }
    },
    onSuccess: () => invalidate(["projects"]),
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ProjectInput }) => {
      const { error } = await supabase
        .from("projects")
        .update({
          name: input.name, client_id: input.client_id, status: input.status,
          estimated_hours: input.estimated_hours, start_date: input.start_date,
          client_review_date: input.client_review_date, closed_date: input.closed_date,
          video_minutes: input.video_minutes, color: input.color,
        })
        .eq("id", id);
      if (error) throw error;
      // reconcile members
      await supabase.from("project_users").delete().eq("project_id", id);
      if (input.users.length)
        await supabase.from("project_users").insert(input.users.map((u) => ({ project_id: id, user_id: u })));
      // reconcile task assignees
      const ids = await taskIdsByName(id);
      const taskIdList = Object.values(ids);
      if (taskIdList.length)
        await supabase.from("task_assignees").delete().in("project_task_id", taskIdList);
      const rows: { project_task_id: string; user_id: string }[] = [];
      TASKS.forEach((t) => (input.taskAssignees[t] ?? []).forEach((uid) =>
        rows.push({ project_task_id: ids[t], user_id: uid })));
      if (rows.length) await supabase.from("task_assignees").insert(rows);
    },
    onSuccess: () => invalidate(["projects"]),
  });

  const setArchived = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("projects").update({ archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["projects"]),
  });

  const patch = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<{ status: string; color: string }> }) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["projects"]),
  });

  // Status change via RPC so it works for assigned artists too (not just managers).
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("set_project_status", { p_id: id, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => invalidate(["projects"]),
  });

  const toggleMember = useMutation({
    mutationFn: async ({ projectId, userId, on }: { projectId: string; userId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("project_users").insert({ project_id: projectId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_users").delete().eq("project_id", projectId).eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(["projects"]),
  });

  return { create, update, setArchived, patch, setStatus, toggleMember };
}

export function useTaskMutations() {
  const invalidate = useInvalidate();

  const setDone = useMutation({
    mutationFn: async ({ taskId, done }: { taskId: string; done: boolean }) => {
      const { error } = await supabase.from("project_tasks").update({ done }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["projects"]),
  });

  const toggleAssignee = useMutation({
    mutationFn: async ({ taskId, userId, on }: { taskId: string; userId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("task_assignees").insert({ project_task_id: taskId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("task_assignees").delete().eq("project_task_id", taskId).eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(["projects"]),
  });

  const addSubtask = useMutation({
    mutationFn: async (s: { taskId: string; title: string; assignee: string | null; createdBy: string }) => {
      const { error } = await supabase.from("subtasks").insert({
        project_task_id: s.taskId, title: s.title, assignee_id: s.assignee, created_by: s.createdBy,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(["projects"]),
  });

  const updateSubtask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { done?: boolean; assignee?: string | null; title?: string } }) => {
      const p: any = {};
      if (patch.done !== undefined) p.done = patch.done;
      if (patch.assignee !== undefined) p.assignee_id = patch.assignee;
      if (patch.title !== undefined) p.title = patch.title;
      const { error } = await supabase.from("subtasks").update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["projects"]),
  });

  const removeSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["projects"]),
  });

  return { setDone, toggleAssignee, addSubtask, updateSubtask, removeSubtask };
}

export function useClientMutations() {
  const invalidate = useInvalidate();
  const create = useMutation({
    mutationFn: async (c: Partial<Client>) => {
      const { error } = await supabase.from("clients").insert(c);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["clients"]),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Client> }) => {
      const { error } = await supabase.from("clients").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["clients"]),
  });
  const setArchived = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("clients").update({ archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["clients"]),
  });
  return { create, update, setArchived };
}

export function useTimeLogMutations() {
  const invalidate = useInvalidate();
  const add = useMutation({
    mutationFn: async (log: Omit<TimeLog, "id">) => {
      const { error } = await supabase.from("time_logs").insert(log);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["time_logs", "projects"]),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<TimeLog, "id">> }) => {
      const { error } = await supabase.from("time_logs").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["time_logs", "projects"]),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["time_logs", "projects"]),
  });
  return { add, update, remove };
}

export function useScheduleMutations() {
  const invalidate = useInvalidate();
  const add = useMutation({
    mutationFn: async (e: Omit<ScheduleEntry, "id">) => {
      const { error } = await supabase.from("schedule_entries").insert(e);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["schedule"]),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ScheduleEntry> }) => {
      const { error } = await supabase.from("schedule_entries").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["schedule"]),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["schedule"]),
  });
  return { add, update, remove };
}
