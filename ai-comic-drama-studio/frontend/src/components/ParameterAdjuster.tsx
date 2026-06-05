import React from 'react';

interface ParameterAdjusterProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

const ParameterAdjuster: React.FC<ParameterAdjusterProps> = ({ 
  label, 
  value, 
  min, 
  max, 
  step = 1, 
  onChange 
}) => {
  return (
    <div className="parameter-adjuster">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span>{value}</span>
    </div>
  );
};

export default ParameterAdjuster;