import React from 'react';
import { Ingredient } from '../types';
import { Utensils, Trash2, Plus } from 'lucide-react';

interface IngredientPanelProps {
  ingredients: Ingredient[];
  setIngredients: (ing: Ingredient[]) => void;
}

const IngredientPanel: React.FC<IngredientPanelProps> = ({ ingredients, setIngredients }) => {
  
  const handleUpdate = (index: number, field: keyof Ingredient, value: string) => {
    const newIng = [...ingredients];
    newIng[index] = { ...newIng[index], [field]: value };
    setIngredients(newIng);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '新食材', amount: '100克' }]);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Utensils className="w-4 h-4 text-brand-500" />
          配方管理 (模块 A-3)
        </h3>
        <button 
          onClick={addIngredient}
          className="p-1 hover:bg-slate-100 rounded-full text-brand-600"
          title="添加食材"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      
      <div className="overflow-y-auto p-0">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 font-medium">名称</th>
              <th className="px-4 py-2 font-medium">用量</th>
              <th className="px-4 py-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ingredients.map((ing, idx) => (
              <tr key={idx} className="group hover:bg-slate-50">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => handleUpdate(idx, 'name', e.target.value)}
                    className="w-full bg-transparent outline-none border-b border-transparent focus:border-brand-300 transition-colors"
                    placeholder="食材名称"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={ing.amount}
                    onChange={(e) => handleUpdate(idx, 'amount', e.target.value)}
                    className="w-full bg-transparent outline-none border-b border-transparent focus:border-brand-300 transition-colors"
                    placeholder="用量"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <button 
                    onClick={() => removeIngredient(idx)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {ingredients.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  暂无配料信息。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IngredientPanel;