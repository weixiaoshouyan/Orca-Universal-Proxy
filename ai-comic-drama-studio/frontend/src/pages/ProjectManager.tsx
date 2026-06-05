import React, { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  theme: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectManagerProps {
  onProjectSelect: (projectId: string) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    theme: 'xianxia',
    duration: 120
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    // 这里应该调用后端API加载项目列表
    // 目前使用模拟数据
    const mockProjects: Project[] = [
      {
        id: 'project_1',
        name: '修仙少年逆袭',
        theme: 'xianxia',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02'
      },
      {
        id: 'project_2',
        name: '仙侠爱情故事',
        theme: 'xianxia',
        createdAt: '2024-01-03',
        updatedAt: '2024-01-04'
      }
    ];
    setProjects(mockProjects);
  };

  const handleCreateProject = async () => {
    // 这里应该调用后端API创建项目
    const newProjectData: Project = {
      id: `project_${Date.now()}`,
      name: newProject.name,
      theme: newProject.theme,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setProjects([...projects, newProjectData]);
    setIsCreating(false);
    setNewProject({ name: '', theme: 'xianxia', duration: 120 });
  };

  return (
    <div className="project-manager">
      <h1>项目管理</h1>
      
      <div className="project-actions">
        <button onClick={() => setIsCreating(true)}>新建项目</button>
      </div>

      {isCreating && (
        <div className="create-project-form">
          <h2>创建新项目</h2>
          <div className="form-group">
            <label>项目名称：</label>
            <input
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              placeholder="输入项目名称"
            />
          </div>
          <div className="form-group">
            <label>题材风格：</label>
            <select
              value={newProject.theme}
              onChange={(e) => setNewProject({ ...newProject, theme: e.target.value })}
            >
              <option value="xianxia">玄幻修仙</option>
              <option value="wuxia">武侠江湖</option>
              <option value="urban">都市情感</option>
              <option value="fantasy">奇幻冒险</option>
            </select>
          </div>
          <div className="form-group">
            <label>目标时长（秒）：</label>
            <input
              type="number"
              value={newProject.duration}
              onChange={(e) => setNewProject({ ...newProject, duration: parseInt(e.target.value) })}
              min={30}
              max={300}
            />
          </div>
          <div className="form-actions">
            <button onClick={handleCreateProject}>创建</button>
            <button onClick={() => setIsCreating(false)}>取消</button>
          </div>
        </div>
      )}

      <div className="project-list">
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            <h3>{project.name}</h3>
            <p>题材：{project.theme === 'xianxia' ? '玄幻修仙' : project.theme}</p>
            <p>创建时间：{project.createdAt}</p>
            <p>更新时间：{project.updatedAt}</p>
            <button onClick={() => onProjectSelect(project.id)}>打开项目</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectManager;