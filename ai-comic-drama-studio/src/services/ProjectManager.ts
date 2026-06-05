import * as fs from 'fs';
import * as path from 'path';
import { ProjectConfig, ProjectState } from '../types';

export class ProjectManager {
  private projectsDir: string;

  constructor() {
    this.projectsDir = path.join(process.cwd(), 'projects');
    this.ensureProjectsDir();
  }

  private ensureProjectsDir() {
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  async createProject(config: ProjectConfig): Promise<ProjectState> {
    const projectDir = path.join(this.projectsDir, config.id);
    
    // 创建项目目录结构
    const dirs = ['images', 'audio', 'video', 'cache', 'storyboard'];
    for (const dir of dirs) {
      const dirPath = path.join(projectDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    // 保存项目配置
    const configPath = path.join(projectDir, 'project.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // 创建初始项目状态
    const state: ProjectState = {
      config,
      visualAssets: [],
      audioAssets: [],
      animations: [],
      status: 'idle',
      progress: 0
    };

    // 保存项目状态
    const statePath = path.join(projectDir, 'state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    return state;
  }

  async loadProject(projectId: string): Promise<ProjectState | null> {
    const projectDir = path.join(this.projectsDir, projectId);
    const statePath = path.join(projectDir, 'state.json');

    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      const stateData = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(stateData);
    } catch (error) {
      console.error('Failed to load project:', error);
      return null;
    }
  }

  async saveProject(projectId: string, state: ProjectState): Promise<boolean> {
    const projectDir = path.join(this.projectsDir, projectId);
    const statePath = path.join(projectDir, 'state.json');

    try {
      state.config.updatedAt = new Date();
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save project:', error);
      return false;
    }
  }

  async listProjects(): Promise<ProjectConfig[]> {
    const projects: ProjectConfig[] = [];

    if (!fs.existsSync(this.projectsDir)) {
      return projects;
    }

    const projectDirs = fs.readdirSync(this.projectsDir);
    
    for (const dir of projectDirs) {
      const configPath = path.join(this.projectsDir, dir, 'project.json');
      if (fs.existsSync(configPath)) {
        try {
          const configData = fs.readFileSync(configPath, 'utf-8');
          projects.push(JSON.parse(configData));
        } catch (error) {
          console.error(`Failed to load project config for ${dir}:`, error);
        }
      }
    }

    return projects;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const projectDir = path.join(this.projectsDir, projectId);
    
    try {
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
      return true;
    } catch (error) {
      console.error('Failed to delete project:', error);
      return false;
    }
  }

  async exportProject(projectId: string, exportPath: string): Promise<boolean> {
    const projectDir = path.join(this.projectsDir, projectId);
    
    try {
      // 复制项目文件到导出路径
      this.copyDirectory(projectDir, exportPath);
      return true;
    } catch (error) {
      console.error('Failed to export project:', error);
      return false;
    }
  }

  private copyDirectory(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async getProjectPath(projectId: string): Promise<string> {
    return path.join(this.projectsDir, projectId);
  }

  async projectExists(projectId: string): Promise<boolean> {
    const projectDir = path.join(this.projectsDir, projectId);
    return fs.existsSync(projectDir);
  }
}