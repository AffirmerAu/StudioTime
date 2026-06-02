// Database row + assembled app types

export type Role = "manager" | "artist";
export type ProjectStatus = "Upcoming" | "In Production" | "With Client" | "Closed";
export type TaskName =
  | "Storyboarding"
  | "Blockout Premiere"
  | "Production"
  | "Internal Review"
  | "Client Review";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  avatar_url: string | null;
}

export interface Client {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived: boolean;
}

export interface Subtask {
  id: string;
  title: string;
  assignee: string | null; // assignee_id
  done: boolean;
  created_by: string | null;
}

export interface ProjectTask {
  id: string;
  assignees: string[];
  done: boolean;
  subtasks: Subtask[];
}

// Project assembled into the shape the UI uses (users[] + tasks{} embedded)
export interface Project {
  id: string;
  name: string;
  client_id: string | null;
  status: ProjectStatus;
  estimated_hours: number;
  start_date: string | null;
  client_review_date: string | null;
  closed_date: string | null;
  video_minutes: number | null;
  color: string | null;
  archived: boolean;
  users: string[];
  tasks: Record<TaskName, ProjectTask>;
}

export interface TimeLog {
  id: string;
  project_id: string;
  user_id: string;
  task: TaskName;
  hours: number;
  log_date: string;
  notes: string | null;
}

export interface ScheduleEntry {
  id: string;
  project_id: string;
  user_id: string;
  task: TaskName | null;
  start_date: string;
  end_date: string;
  hours: number;
  notes: string | null;
}

// Payload used when creating / editing a project from the modal
export interface ProjectInput {
  name: string;
  client_id: string | null;
  status: ProjectStatus;
  estimated_hours: number;
  start_date: string | null;
  client_review_date: string | null;
  closed_date: string | null;
  video_minutes: number | null;
  color: string | null;
  users: string[];
  taskAssignees: Record<TaskName, string[]>;
}
