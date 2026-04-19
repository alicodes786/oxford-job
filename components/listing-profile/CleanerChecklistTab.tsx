'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, GripVertical, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ChecklistItem } from '@/lib/models';

interface CleanerChecklistTabProps {
  listingId: string;
  listingName: string;
}

export function CleanerChecklistTab({ listingId, listingName }: CleanerChecklistTabProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  
  const [formData, setFormData] = useState({
    type: 'checkbox' as ChecklistItem['type'],
    question: '',
    required: true
  });

  useEffect(() => {
    loadChecklist();
  }, [listingId]);

  const loadChecklist = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/checklist`);
      const data = await response.json();
      
      if (data.success && data.checklist) {
        setChecklistItems(data.checklist.checklist_items || []);
      } else {
        setChecklistItems([]);
      }
    } catch (error) {
      console.error('Error loading checklist:', error);
      toast.error('Failed to load checklist');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChecklist = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist_items: checklistItems })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Checklist saved successfully');
      } else {
        toast.error(data.error || 'Failed to save checklist');
      }
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast.error('Failed to save checklist');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = () => {
    if (!formData.question) {
      toast.error('Please enter a question');
      return;
    }

    const newItem: ChecklistItem = {
      id: editingItem?.id || `item-${Date.now()}`,
      type: formData.type,
      question: formData.question,
      required: formData.required,
      order: editingItem ? editingItem.order : checklistItems.length + 1
    };

    if (editingItem) {
      // Update existing
      setChecklistItems(checklistItems.map(item => 
        item.id === editingItem.id ? newItem : item
      ));
      toast.success('Question updated');
    } else {
      // Add new
      setChecklistItems([...checklistItems, newItem]);
      toast.success('Question added');
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormData({
      type: item.type,
      question: item.question,
      required: item.required
    });
    setDialogOpen(true);
  };

  const handleDelete = (itemId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    setChecklistItems(checklistItems.filter(item => item.id !== itemId));
    toast.success('Question deleted');
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...checklistItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    
    // Update order values
    newItems.forEach((item, idx) => {
      item.order = idx + 1;
    });
    
    setChecklistItems(newItems);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      type: 'checkbox',
      question: '',
      required: true
    });
  };

  const getTypeLabel = (type: ChecklistItem['type']) => {
    switch (type) {
      case 'checkbox': return 'Yes/No';
      case 'text': return 'Text Input';
      case 'rating': return 'Rating (1-5)';
    }
  };

  const getTypeIcon = (type: ChecklistItem['type']) => {
    switch (type) {
      case 'checkbox': return '☐';
      case 'text': return '📝';
      case 'rating': return '⭐';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customize Checklist for {listingName}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Create custom questions that cleaners must complete when submitting reports for this listing
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Question' : 'Add New Question'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="type">Question Type</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checkbox">Checkbox (Yes/No)</SelectItem>
                          <SelectItem value="text">Text Input</SelectItem>
                          <SelectItem value="rating">Rating (1-5 stars)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="question">Question *</Label>
                      <Input
                        id="question"
                        value={formData.question}
                        onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                        placeholder="e.g., All beds made with fresh linens"
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="required"
                        checked={formData.required}
                        onCheckedChange={(checked) => setFormData({ ...formData, required: checked })}
                      />
                      <Label htmlFor="required">Required field</Label>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddItem}>
                      {editingItem ? 'Update' : 'Add'} Question
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Button 
                onClick={handleSaveChecklist}
                disabled={isSaving || checklistItems.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Checklist'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading checklist...</div>
          ) : checklistItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No questions added yet. Click "Add Question" to create your first checklist item.
            </div>
          ) : (
            <div className="space-y-3">
              {checklistItems.map((item, index) => (
                <div 
                  key={item.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex flex-col gap-1 mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => moveItem(index, 'up')}
                          disabled={index === 0}
                        >
                          ▲
                        </Button>
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => moveItem(index, 'down')}
                          disabled={index === checklistItems.length - 1}
                        >
                          ▼
                        </Button>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getTypeIcon(item.type)}</span>
                          <span className="font-medium">{item.question}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>Type: {getTypeLabel(item.type)}</span>
                          <span>•</span>
                          <span>{item.required ? 'Required' : 'Optional'}</span>
                          <span>•</span>
                          <span>Order: {item.order}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {checklistItems.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> This checklist will automatically appear in cleaner reports when 
                cleaners submit their work for {listingName}. Make sure to save your changes!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

