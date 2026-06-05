import { ProjectManager } from '../../src/services/ProjectManager';
import { ProjectConfig, ProjectState } from '../../src/types';

describe('ProjectManager', () => {
  let manager: ProjectManager;

  beforeEach(() => {
    manager = new ProjectManager();
  });

  test('should create new project', async () => {
    const config: ProjectConfig = {
      id: 'test_project',
      name: '测试项目',
      theme: 'xianxia',
      style: 'manga',
      duration: 120,
      quality: 'high',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const project = await manager.createProject(config);
    expect(project).toBeDefined();
    expect(project.config.id).toBe('test_project');
  });

  test('should load existing project', async () => {
    const project = await manager.loadProject('test_project');
    expect(project).toBeDefined();
    expect(project?.config.name).toBe('测试项目');
  });

  test('should save project state', async () => {
    const state: ProjectState = {
      config: {
        id: 'test_project',
        name: '测试项目',
        theme: 'xianxia',
        style: 'manga',
        duration: 120,
        quality: 'high',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      visualAssets: [],
      audioAssets: [],
      animations: [],
      status: 'editing',
      progress: 50
    };

    const result = await manager.saveProject('test_project', state);
    expect(result).toBe(true);
  });

  test('should list all projects', async () => {
    const projects = await manager.listProjects();
    expect(Array.isArray(projects)).toBe(true);
  });
});