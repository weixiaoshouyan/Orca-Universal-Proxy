import React from 'react';

interface ModelSelectorProps {
  label: string;
  models: { value: string; label: string }[];
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  label, 
  models, 
  selectedModel, 
  onModelChange 
}) => {
  return (
    <div className="model-selector">
      <label>{label}</label>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
      >
        {models.map((model) => (
          <option key={model.value} value={model.value}>
            {model.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;