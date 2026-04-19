'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Upload,
  Download,
  Eye,
  EyeOff,
  MapPin,
  Phone,
  FileText,
  Wrench,
  Home,
  Key,
  Shield,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import {
  ListingOperations,
  ConsumableItem,
  ListingOperationPhoto,
  ListingOperationInvoice,
  ListingIssueLog,
  ListingOperationChangelog,
  DamageReport,
  CleaningSchedule
} from '@/lib/models';

interface OperationsTabProps {
  listingId: string;
}

export function OperationsTab({ listingId }: OperationsTabProps) {
  // State for operations data
  const [operations, setOperations] = useState<Partial<ListingOperations> | null>(null);
  const [cleaningSchedule, setCleaningSchedule] = useState<CleaningSchedule | null>(null);
  const [photos, setPhotos] = useState<ListingOperationPhoto[]>([]);
  const [invoices, setInvoices] = useState<ListingOperationInvoice[]>([]);
  const [issues, setIssues] = useState<ListingIssueLog[]>([]);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [changelog, setChangelog] = useState<ListingOperationChangelog[]>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // UI states
  const [showCodes, setShowCodes] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    loadAllData();
  }, [listingId]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadOperations(),
        loadCleaningSchedule(),
        loadPhotos(),
        loadInvoices(),
        loadIssues(),
        loadDamageReports(),
        loadChangelog()
      ]);
    } catch (error) {
      console.error('Error loading operations data:', error);
      toast.error('Failed to load operations data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOperations = async () => {
    const response = await fetch(`/api/listings/${listingId}/operations`);
    const data = await response.json();
    if (data.success) {
      setOperations(data.operations);
    }
  };

  const loadCleaningSchedule = async () => {
    const response = await fetch(`/api/listings/${listingId}/operations/cleaning-schedule`);
    const data = await response.json();
    if (data.success) {
      setCleaningSchedule(data.schedule);
    }
  };

  const loadPhotos = async () => {
    const response = await fetch(`/api/listings/${listingId}/operations/photos`);
    const data = await response.json();
    if (data.success) {
      setPhotos(data.photos);
    }
  };

  const loadInvoices = async () => {
    const response = await fetch(`/api/listings/${listingId}/operations/invoices`);
    const data = await response.json();
    if (data.success) {
      setInvoices(data.invoices);
    }
  };

  const loadIssues = async () => {
    const response = await fetch(`/api/listings/${listingId}/operations/issues`);
    const data = await response.json();
    if (data.success) {
      setIssues(data.issues);
    }
  };

  const loadDamageReports = async (week?: string) => {
    const weekParam = week || selectedWeek;
    const response = await fetch(`/api/listings/${listingId}/operations/damage-reports?week=${weekParam}`);
    const data = await response.json();
    if (data.success) {
      setDamageReports(data.reports);
    }
  };

  const loadChangelog = async () => {
    const response = await fetch(`/api/listings/${listingId}/operations/changelog`);
    const data = await response.json();
    if (data.success) {
      setChangelog(data.changelog);
    }
  };

  const saveOperations = async (updatedOps: Partial<ListingOperations>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/operations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOps)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setOperations(data.operations);
        toast.success('Operations data saved');
        return true;
      } else {
        toast.error(data.error || 'Failed to save');
        return false;
      }
    } catch (error) {
      console.error('Error saving operations:', error);
      toast.error('Failed to save operations data');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const logChange = async (changeType: string, description: string) => {
    try {
      await fetch(`/api/listings/${listingId}/operations/changelog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          change_type: changeType,
          description,
          changed_by_name: 'Admin'
        })
      });
      loadChangelog();
    } catch (error) {
      console.error('Error logging change:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading operations data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* OPERATIONS OVERVIEW BANNER */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Last Cleaning</p>
                <p className="font-semibold text-gray-900">
                  {cleaningSchedule?.last_cleaning_date && cleaningSchedule.last_cleaning_date !== '' 
                    ? format(parseISO(cleaningSchedule.last_cleaning_date), 'dd MMM yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-indigo-600" />
              <div>
                <p className="text-xs text-gray-600">Next Cleaning</p>
                <p className="font-semibold text-gray-900">
                  {cleaningSchedule?.next_cleaning_date && cleaningSchedule.next_cleaning_date !== ''
                    ? format(parseISO(cleaningSchedule.next_cleaning_date), 'dd MMM yyyy')
                    : 'No Schedule'}
                </p>
              </div>
            </div>
            
            {/* STATUS - COMMENTED OUT FOR NOW */}
            {/* <div className="flex items-center gap-3">
              {cleaningSchedule?.status === 'on_time' && <CheckCircle className="h-8 w-8 text-green-600" />}
              {cleaningSchedule?.status === 'overdue' && <AlertTriangle className="h-8 w-8 text-red-600" />}
              {cleaningSchedule?.status === 'no_schedule' && <Clock className="h-8 w-8 text-gray-400" />}
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge className={
                  cleaningSchedule?.status === 'on_time' ? 'bg-green-100 text-green-800' :
                  cleaningSchedule?.status === 'overdue' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  {cleaningSchedule?.status === 'on_time' && 'On Time'}
                  {cleaningSchedule?.status === 'overdue' && 'Overdue'}
                  {cleaningSchedule?.status === 'no_schedule' && 'No Schedule'}
                </Badge>
              </div>
            </div> */}
            
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600">Open Issues</p>
                <p className="font-semibold text-gray-900">
                  {issues.filter(i => i.status !== 'resolved').length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT COLUMN: PROPERTY OPERATIONS & SECURITY */}
        <OperationsSecurityWidget
          operations={operations}
          onSave={saveOperations}
          onLogChange={logChange}
          isSaving={isSaving}
          showCodes={showCodes}
          setShowCodes={setShowCodes}
        />

        {/* RIGHT COLUMN: EMERGENCY & REFERENCE INFO */}
        <EmergencyReferenceWidget
          operations={operations}
          onSave={saveOperations}
          onLogChange={logChange}
          isSaving={isSaving}
        />
      </div>

      {/* FULL-WIDTH SECTIONS */}
      <PhotoGalleryWidget
        listingId={listingId}
        photos={photos}
        onReload={loadPhotos}
      />
      
      <InvoiceUploadsWidget
        listingId={listingId}
        invoices={invoices}
        onReload={loadInvoices}
      />
      
      <DamageReportsWidget
        listingId={listingId}
        reports={damageReports}
        selectedWeek={selectedWeek}
        onWeekChange={(week: string) => {
          setSelectedWeek(week);
          loadDamageReports(week);
        }}
      />
      
      <IssueLogWidget
        listingId={listingId}
        issues={issues}
        onReload={loadIssues}
      />
      
      <ChangelogWidget
        changelog={changelog}
      />
    </div>
  );
}

// GROUPED WIDGET COMPONENTS

function OperationsSecurityWidget({ operations, onSave, onLogChange, isSaving, showCodes, setShowCodes }: any) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Property Operations & Security</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="cleaner-notes" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-9">
            <TabsTrigger value="cleaner-notes" className="text-xs">Notes</TabsTrigger>
            <TabsTrigger value="consumables" className="text-xs">Consumables</TabsTrigger>
            <TabsTrigger value="maintenance" className="text-xs">Maintenance</TabsTrigger>
            <TabsTrigger value="appliances" className="text-xs">Appliances</TabsTrigger>
            <TabsTrigger value="codes" className="text-xs">Codes</TabsTrigger>
          </TabsList>

          <TabsContent value="cleaner-notes" className="mt-3">
            <CleanerNotesWidget operations={operations} onSave={onSave} onLogChange={onLogChange} isSaving={isSaving} compact />
          </TabsContent>

          <TabsContent value="consumables" className="mt-3">
            <ConsumablesWidget operations={operations} onSave={onSave} onLogChange={onLogChange} isSaving={isSaving} compact />
          </TabsContent>

          <TabsContent value="maintenance" className="mt-3">
            <MaintenanceNotesWidget operations={operations} onSave={onSave} onLogChange={onLogChange} isSaving={isSaving} compact />
          </TabsContent>

          <TabsContent value="appliances" className="mt-3">
            <AppliancesWidget operations={operations} onSave={onSave} onLogChange={onLogChange} isSaving={isSaving} compact />
          </TabsContent>

          <TabsContent value="codes" className="mt-3">
            <CodesContactsWidget operations={operations} onSave={onSave} onLogChange={onLogChange} isSaving={isSaving} showCodes={showCodes} setShowCodes={setShowCodes} compact />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function EmergencyReferenceWidget({ operations, onSave, onLogChange, isSaving }: any) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Emergency & Reference Info</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="emergency" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="emergency" className="text-xs">Emergency #s</TabsTrigger>
            <TabsTrigger value="directions" className="text-xs">Directions</TabsTrigger>
          </TabsList>

          <TabsContent value="emergency" className="mt-3">
            <EmergencyNumbersWidget operations={operations} onSave={onSave} onLogChange={onLogChange} isSaving={isSaving} compact />
          </TabsContent>

          <TabsContent value="directions" className="mt-3">
            <DirectionsWidget operations={operations} onSave={onSave} onLogChange={onLogChange} isSaving={isSaving} compact />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// INDIVIDUAL WIDGET COMPONENTS (used within tabs)

function CleanerNotesWidget({ operations, onSave, onLogChange, isSaving, compact }: any) {
  const [notes, setNotes] = useState(operations?.cleaner_notes || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    const success = await onSave({ ...operations, cleaner_notes: notes });
    if (success) {
      setIsEditing(false);
      onLogChange('general', 'Standard cleaner notes updated');
    }
  };

  const content = (
    <>
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span className="font-semibold">Standard Cleaner Notes</span>
          </div>
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
              <Edit className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      {compact && !isEditing && (
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>
      )}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Leave 4 bath towels, 2 hand towels..."
            rows={4}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-8">
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="h-8"
              onClick={() => {
                setNotes(operations?.cleaner_notes || '');
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {operations?.cleaner_notes || 'No cleaner notes set.'}
        </p>
      )}
    </>
  );

  if (compact) return <div>{content}</div>;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="h-4 w-4" />
          Standard Cleaner Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  );
}

function ConsumablesWidget({ operations, onSave, onLogChange, isSaving, compact }: any) {
  const [consumables, setConsumables] = useState<ConsumableItem[]>(operations?.consumables || []);
  const [isEditing, setIsEditing] = useState(false);
  const [newItem, setNewItem] = useState({ item: '', quantity: 0, last_checked: format(new Date(), 'yyyy-MM-dd') });

  const addItem = () => {
    if (!newItem.item || newItem.quantity <= 0) {
      toast.error('Please fill in all fields');
      return;
    }
    setConsumables([...consumables, newItem]);
    setNewItem({ item: '', quantity: 0, last_checked: format(new Date(), 'yyyy-MM-dd') });
  };

  const removeItem = (index: number) => {
    setConsumables(consumables.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const success = await onSave({ ...operations, consumables });
    if (success) {
      setIsEditing(false);
      onLogChange('general', 'Consumables checklist updated');
    }
  };

  const content = (
    <>
      {compact && !isEditing && (
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>
      )}
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
              <Edit className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-2">
              {consumables.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{item.item}</p>
                    <p className="text-sm text-gray-600">Qty: {item.quantity} | Last: {item.last_checked ? format(parseISO(item.last_checked), 'dd MMM yyyy') : 'N/A'}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeItem(index)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-3 space-y-2">
              <Input
                placeholder="Item name (e.g., Soap)"
                value={newItem.item}
                onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Quantity"
                value={newItem.quantity || ''}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
              />
              <Button onClick={addItem} size="sm" variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setConsumables(operations?.consumables || []);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {consumables.length === 0 ? (
              <p className="text-gray-500 text-sm">No consumables added</p>
            ) : (
              consumables.map((item, index) => (
                <div key={index} className="p-2 bg-gray-50 rounded">
                  <p className="font-medium">{item.item}</p>
                  <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                </div>
              ))
            )}
          </div>
        )}
    </>
  );

  if (compact) return <div>{content}</div>;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Consumables Checklist</CardTitle>
      </CardHeader>
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  );
}

function MaintenanceNotesWidget({ operations, onSave, onLogChange, isSaving, compact }: any) {
  const [notes, setNotes] = useState(operations?.maintenance_notes || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    const success = await onSave({ ...operations, maintenance_notes: notes });
    if (success) {
      setIsEditing(false);
      onLogChange('maintenance', 'Maintenance notes updated');
    }
  };

  const content = (
    <>
      {compact && !isEditing && (
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>
      )}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Boiler reset steps, heater thermostat location, etc."
            rows={6}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-8">
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="h-8"
              onClick={() => {
                setNotes(operations?.maintenance_notes || '');
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {operations?.maintenance_notes || 'No maintenance notes set.'}
        </p>
      )}
    </>
  );

  if (compact) return <div>{content}</div>;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Maintenance Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  );
}

function AppliancesWidget({ operations, onSave, onLogChange, isSaving, compact }: any) {
  const [appliances, setAppliances] = useState(operations?.appliances || {});
  const [isEditing, setIsEditing] = useState(false);

  const fields = [
    { key: 'washing_machine_type', label: 'Washing Machine Type', placeholder: 'e.g., Front-load' },
    { key: 'washing_machine_model', label: 'Washing Machine Model', placeholder: 'e.g., LG WM3900HWA' },
    { key: 'washing_machine_instructions', label: 'Special Instructions', placeholder: 'e.g., Use cold water only' },
    { key: 'iron_location', label: 'Iron Location', placeholder: 'e.g., Hallway closet' },
    { key: 'vacuum_location', label: 'Vacuum Location', placeholder: 'e.g., Under stairs' },
    { key: 'spare_linen_location', label: 'Spare Linen Location', placeholder: 'e.g., Bedroom 2 wardrobe' },
    { key: 'common_issues', label: 'Common Issues', placeholder: 'e.g., Oven trips if both hobs used' },
    { key: 'boiler_notes', label: 'Boiler/Heating Notes', placeholder: 'e.g., Reset button behind wardrobe' },
    { key: 'water_shutoff', label: 'Water Shut-off Location', placeholder: 'e.g., Under sink in kitchen' },
    { key: 'fuse_box', label: 'Fuse Box Location', placeholder: 'e.g., Inside front door' },
    { key: 'ac_remote', label: 'AC Remote Instructions', placeholder: 'e.g., On mantle' }
  ];

  const handleSave = async () => {
    const success = await onSave({ ...operations, appliances });
    if (success) {
      setIsEditing(false);
      onLogChange('maintenance', 'Appliances & accessories updated');
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {!isEditing && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
        {isEditing ? (
          <div className="space-y-2">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {fields.map(field => (
                <div key={field.key}>
                  <Label className="text-xs">{field.label}</Label>
                  <Input
                    value={appliances[field.key] || ''}
                    onChange={(e) => setAppliances({ ...appliances, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-8">
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8"
                onClick={() => {
                  setAppliances(operations?.appliances || {});
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {fields.map(field => appliances[field.key] && (
              <div key={field.key}>
                <p className="font-medium text-gray-700 text-xs">{field.label}:</p>
                <p className="text-gray-600 text-xs">{appliances[field.key]}</p>
              </div>
            ))}
            {Object.keys(appliances).length === 0 && (
              <p className="text-gray-500 text-sm">No appliance info added</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Appliances & Accessories</CardTitle>
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {fields.map(field => (
                <div key={field.key}>
                  <Label>{field.label}</Label>
                  <Input
                    value={appliances[field.key] || ''}
                    onChange={(e) => setAppliances({ ...appliances, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setAppliances(operations?.appliances || {});
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {fields.map(field => appliances[field.key] && (
              <div key={field.key}>
                <p className="font-medium text-gray-700">{field.label}:</p>
                <p className="text-gray-600">{appliances[field.key]}</p>
              </div>
            ))}
            {Object.keys(appliances).length === 0 && (
              <p className="text-gray-500">No appliance info added</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CodesContactsWidget({ operations, onSave, onLogChange, isSaving, showCodes, setShowCodes, compact }: any) {
  const [data, setData] = useState({
    spare_key_location: operations?.spare_key_location || '',
    key_safe_code: operations?.key_safe_code || '',
    parking_access_code: operations?.parking_access_code || '',
    gate_code: operations?.gate_code || '',
    emergency_contact_name: operations?.emergency_contact_name || '',
    emergency_contact_phone: operations?.emergency_contact_phone || ''
  });
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    const success = await onSave({ ...operations, ...data });
    if (success) {
      setIsEditing(false);
      onLogChange('code_update', 'Access codes and contacts updated');
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowCodes(!showCodes)} className="h-8">
            {showCodes ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Spare Key Location</Label>
              <Input
                value={data.spare_key_location}
                onChange={(e) => setData({ ...data, spare_key_location: e.target.value })}
                placeholder="e.g., Under mat"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Key Safe Code</Label>
              <Input
                type={showCodes ? 'text' : 'password'}
                value={data.key_safe_code}
                onChange={(e) => setData({ ...data, key_safe_code: e.target.value })}
                placeholder="****"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Parking Access Code</Label>
              <Input
                type={showCodes ? 'text' : 'password'}
                value={data.parking_access_code}
                onChange={(e) => setData({ ...data, parking_access_code: e.target.value })}
                placeholder="****"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Gate Code</Label>
              <Input
                type={showCodes ? 'text' : 'password'}
                value={data.gate_code}
                onChange={(e) => setData({ ...data, gate_code: e.target.value })}
                placeholder="****"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Emergency Contact Name</Label>
              <Input
                value={data.emergency_contact_name}
                onChange={(e) => setData({ ...data, emergency_contact_name: e.target.value })}
                placeholder="e.g., John"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Emergency Contact Phone</Label>
              <Input
                value={data.emergency_contact_phone}
                onChange={(e) => setData({ ...data, emergency_contact_phone: e.target.value })}
                placeholder="e.g., +44754954995"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-8">
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8"
                onClick={() => {
                  setData({
                    spare_key_location: operations?.spare_key_location || '',
                    key_safe_code: operations?.key_safe_code || '',
                    parking_access_code: operations?.parking_access_code || '',
                    gate_code: operations?.gate_code || '',
                    emergency_contact_name: operations?.emergency_contact_name || '',
                    emergency_contact_phone: operations?.emergency_contact_phone || ''
                  });
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div>
              <p className="font-medium text-xs">Key Location:</p>
              <p className="text-gray-600 text-xs">{data.spare_key_location || 'Not set'}</p>
            </div>
            <div>
              <p className="font-medium text-xs">Key Safe:</p>
              <p className="text-gray-600 text-xs">{showCodes ? (data.key_safe_code || 'Not set') : '****'}</p>
            </div>
            <div>
              <p className="font-medium text-xs">Parking:</p>
              <p className="text-gray-600 text-xs">{showCodes ? (data.parking_access_code || 'Not set') : '****'}</p>
            </div>
            <div>
              <p className="font-medium text-xs">Gate:</p>
              <p className="text-gray-600 text-xs">{showCodes ? (data.gate_code || 'Not set') : '****'}</p>
            </div>
            <div>
              <p className="font-medium text-xs">Emergency Contact:</p>
              <p className="text-gray-600 text-xs">{data.emergency_contact_name || 'Not set'} {data.emergency_contact_phone && `(${data.emergency_contact_phone})`}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Codes & Contacts
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCodes(!showCodes)}>
              {showCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {!isEditing && (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <Label>Spare Key Location</Label>
              <Input
                value={data.spare_key_location}
                onChange={(e) => setData({ ...data, spare_key_location: e.target.value })}
                placeholder="e.g., Under mat"
              />
            </div>
            <div>
              <Label>Key Safe Code</Label>
              <Input
                type={showCodes ? 'text' : 'password'}
                value={data.key_safe_code}
                onChange={(e) => setData({ ...data, key_safe_code: e.target.value })}
                placeholder="****"
              />
            </div>
            <div>
              <Label>Parking Access Code</Label>
              <Input
                type={showCodes ? 'text' : 'password'}
                value={data.parking_access_code}
                onChange={(e) => setData({ ...data, parking_access_code: e.target.value })}
                placeholder="****"
              />
            </div>
            <div>
              <Label>Gate Code</Label>
              <Input
                type={showCodes ? 'text' : 'password'}
                value={data.gate_code}
                onChange={(e) => setData({ ...data, gate_code: e.target.value })}
                placeholder="****"
              />
            </div>
            <div>
              <Label>Emergency Contact Name</Label>
              <Input
                value={data.emergency_contact_name}
                onChange={(e) => setData({ ...data, emergency_contact_name: e.target.value })}
                placeholder="e.g., John Doe"
              />
            </div>
            <div>
              <Label>Emergency Contact Phone</Label>
              <Input
                value={data.emergency_contact_phone}
                onChange={(e) => setData({ ...data, emergency_contact_phone: e.target.value })}
                placeholder="e.g., +44 7XXX XXXXXX"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setData({
                    spare_key_location: operations?.spare_key_location || '',
                    key_safe_code: operations?.key_safe_code || '',
                    parking_access_code: operations?.parking_access_code || '',
                    gate_code: operations?.gate_code || '',
                    emergency_contact_name: operations?.emergency_contact_name || '',
                    emergency_contact_phone: operations?.emergency_contact_phone || ''
                  });
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {data.spare_key_location && <p><span className="font-medium">Key Location:</span> {data.spare_key_location}</p>}
            {data.key_safe_code && <p><span className="font-medium">Key Safe:</span> {showCodes ? data.key_safe_code : '••••'}</p>}
            {data.parking_access_code && <p><span className="font-medium">Parking:</span> {showCodes ? data.parking_access_code : '••••'}</p>}
            {data.gate_code && <p><span className="font-medium">Gate:</span> {showCodes ? data.gate_code : '••••'}</p>}
            {data.emergency_contact_name && <p><span className="font-medium">Emergency Contact:</span> {data.emergency_contact_name}</p>}
            {data.emergency_contact_phone && <p><span className="font-medium">Phone:</span> {data.emergency_contact_phone}</p>}
            {!data.spare_key_location && !data.key_safe_code && <p className="text-gray-500">No codes set</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmergencyNumbersWidget({ operations, onSave, onLogChange, isSaving, compact }: any) {
  const [numbers, setNumbers] = useState(operations?.emergency_numbers || {});
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    const success = await onSave({ ...operations, emergency_numbers: numbers });
    if (success) {
      setIsEditing(false);
      onLogChange('contact_update', 'Emergency numbers updated');
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {!isEditing && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
        {isEditing ? (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Council</Label>
              <Input
                value={numbers.council || ''}
                onChange={(e) => setNumbers({ ...numbers, council: e.target.value })}
                placeholder="e.g., +44 20 1234 5678"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Building Concierge</Label>
              <Input
                value={numbers.building_concierge || ''}
                onChange={(e) => setNumbers({ ...numbers, building_concierge: e.target.value })}
                placeholder="e.g., +44 20 8765 4321"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Nearest Pharmacy</Label>
              <Input
                value={numbers.nearest_pharmacy || ''}
                onChange={(e) => setNumbers({ ...numbers, nearest_pharmacy: e.target.value })}
                placeholder="e.g., +44 20 5555 6666"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-8">
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8"
                onClick={() => {
                  setNumbers(operations?.emergency_numbers || {});
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            {Object.keys(numbers).length === 0 ? (
              <p className="text-gray-500 text-xs">No emergency numbers set</p>
            ) : (
              <>
                {numbers.council && (
                  <div>
                    <p className="font-medium text-xs">Council:</p>
                    <p className="text-gray-600 text-xs">{numbers.council}</p>
                  </div>
                )}
                {numbers.building_concierge && (
                  <div>
                    <p className="font-medium text-xs">Building Concierge:</p>
                    <p className="text-gray-600 text-xs">{numbers.building_concierge}</p>
                  </div>
                )}
                {numbers.nearest_pharmacy && (
                  <div>
                    <p className="font-medium text-xs">Nearest Pharmacy:</p>
                    <p className="text-gray-600 text-xs">{numbers.nearest_pharmacy}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Emergency Numbers
          </CardTitle>
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <Label>Council</Label>
              <Input
                value={numbers.council || ''}
                onChange={(e) => setNumbers({ ...numbers, council: e.target.value })}
                placeholder="Council phone number"
              />
            </div>
            <div>
              <Label>Building Concierge</Label>
              <Input
                value={numbers.building_concierge || ''}
                onChange={(e) => setNumbers({ ...numbers, building_concierge: e.target.value })}
                placeholder="Concierge phone number"
              />
            </div>
            <div>
              <Label>Nearest Pharmacy</Label>
              <Input
                value={numbers.nearest_pharmacy || ''}
                onChange={(e) => setNumbers({ ...numbers, nearest_pharmacy: e.target.value })}
                placeholder="Pharmacy phone number"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setNumbers(operations?.emergency_numbers || {});
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {numbers.council && <p><span className="font-medium">Council:</span> {numbers.council}</p>}
            {numbers.building_concierge && <p><span className="font-medium">Concierge:</span> {numbers.building_concierge}</p>}
            {numbers.nearest_pharmacy && <p><span className="font-medium">Pharmacy:</span> {numbers.nearest_pharmacy}</p>}
            {Object.keys(numbers).length === 0 && <p className="text-gray-500">No emergency numbers set</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DirectionsWidget({ operations, onSave, onLogChange, isSaving, compact }: any) {
  const [data, setData] = useState({
    directions_pdf_url: operations?.directions_pdf_url || '',
    directions_maps_link: operations?.directions_maps_link || ''
  });
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    const success = await onSave({ ...operations, ...data });
    if (success) {
      setIsEditing(false);
      onLogChange('general', 'Cleaner directions updated');
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {!isEditing && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
        {isEditing ? (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">PDF Link</Label>
              <Input
                value={data.directions_pdf_url}
                onChange={(e) => setData({ ...data, directions_pdf_url: e.target.value })}
                placeholder="https://example.com/directions.pdf"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Google Maps Link</Label>
              <Input
                value={data.directions_maps_link}
                onChange={(e) => setData({ ...data, directions_maps_link: e.target.value })}
                placeholder="https://goo.gl/maps/..."
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-8">
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8"
                onClick={() => {
                  setData({
                    directions_pdf_url: operations?.directions_pdf_url || '',
                    directions_maps_link: operations?.directions_maps_link || ''
                  });
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            {!data.directions_pdf_url && !data.directions_maps_link ? (
              <p className="text-gray-500 text-xs">No directions set</p>
            ) : (
              <>
                {data.directions_pdf_url && (
                  <a href={data.directions_pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                    <FileText className="h-3 w-3" />
                    PDF Directions
                  </a>
                )}
                {data.directions_maps_link && (
                  <a href={data.directions_maps_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                    <MapPin className="h-3 w-3" />
                    Google Maps
                  </a>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Cleaner Directions
          </CardTitle>
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <Label>PDF URL</Label>
              <Input
                value={data.directions_pdf_url}
                onChange={(e) => setData({ ...data, directions_pdf_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Google Maps Link</Label>
              <Input
                value={data.directions_maps_link}
                onChange={(e) => setData({ ...data, directions_maps_link: e.target.value })}
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setData({
                    directions_pdf_url: operations?.directions_pdf_url || '',
                    directions_maps_link: operations?.directions_maps_link || ''
                  });
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {data.directions_pdf_url && (
              <a href={data.directions_pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                <FileText className="h-4 w-4" />
                View PDF Directions
              </a>
            )}
            {data.directions_maps_link && (
              <a href={data.directions_maps_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                <MapPin className="h-4 w-4" />
                Open in Google Maps
              </a>
            )}
            {!data.directions_pdf_url && !data.directions_maps_link && (
              <p className="text-gray-500 text-sm">No directions set</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Full-width widgets (Photo Gallery, Invoices, Damage Reports, Issue Log, Changelog)
// These will be added in the next part...

function PhotoGalleryWidget({ listingId, photos, onReload }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [photoType, setPhotoType] = useState('general');
  const [photoDescription, setPhotoDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`File ${file.name} is too large (max 10MB)`);
    }

    const base64 = await fileToBase64(file);
    const fileExt = file.name.split('.').pop();
    const fileName = `listing-${listingId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: base64,
        folder: `listings/${listingId}/operations`,
        fileName: fileName
      }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    return data.url;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one photo');
      return;
    }

    setIsUploading(true);
    try {
      for (const file of selectedFiles) {
        const url = await uploadToCloudinary(file);
        
        await fetch(`/api/listings/${listingId}/operations/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo_type: photoType,
            photo_url: url,
            photo_description: photoDescription
          })
        });
      }

      toast.success('Photos uploaded successfully');
      setShowDialog(false);
      setSelectedFiles([]);
      setPhotoDescription('');
      setPhotoType('general');
      onReload();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    try {
      await fetch(`/api/listings/${listingId}/operations/photos/${photoId}`, {
        method: 'DELETE'
      });
      toast.success('Photo deleted');
      onReload();
    } catch (error) {
      toast.error('Failed to delete photo');
    }
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Photo Gallery
          </CardTitle>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8">
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Photos</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Photo Type</Label>
                  <Select value={photoType} onValueChange={setPhotoType}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="before">Before Cleaning</SelectItem>
                      <SelectItem value="after">After Cleaning</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="damage">Damage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Description (Optional)</Label>
                  <Input
                    value={photoDescription}
                    onChange={(e) => setPhotoDescription(e.target.value)}
                    placeholder="e.g., Kitchen after cleaning"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-sm">Select Photos</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="h-9"
                  />
                  {selectedFiles.length > 0 && (
                    <p className="text-xs text-gray-600 mt-1">{selectedFiles.length} file(s) selected</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleUpload} disabled={isUploading} size="sm">
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {photos.length === 0 ? (
          <p className="text-gray-500 text-sm">No photos uploaded yet</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo: ListingOperationPhoto) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.photo_url}
                  alt={photo.photo_description || 'Photo'}
                  className="w-full h-32 object-cover rounded border"
                />
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(photo.id)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {photo.photo_type && (
                  <Badge className="absolute bottom-1 left-1 text-xs">{photo.photo_type}</Badge>
                )}
                {photo.photo_description && (
                  <p className="text-xs text-gray-600 mt-1 truncate">{photo.photo_description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceUploadsWidget({ listingId, invoices, onReload }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    invoice_name: '',
    vendor_name: '',
    invoice_amount: '',
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`File is too large (max 10MB)`);
    }

    const base64 = await fileToBase64(file);
    const fileExt = file.name.split('.').pop();
    const fileName = `invoice-${listingId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: base64,
        folder: `listings/${listingId}/invoices`,
        fileName: fileName
      }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    return data.url;
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    if (!formData.invoice_name || !formData.vendor_name) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(selectedFile);
      
      await fetch(`/api/listings/${listingId}/operations/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_url: url,
          invoice_name: formData.invoice_name,
          vendor_name: formData.vendor_name,
          invoice_amount: formData.invoice_amount ? parseFloat(formData.invoice_amount) : null,
          invoice_date: formData.invoice_date,
          description: formData.description
        })
      });

      toast.success('Invoice uploaded successfully');
      setShowDialog(false);
      setSelectedFile(null);
      setFormData({
        invoice_name: '',
        vendor_name: '',
        invoice_amount: '',
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        description: ''
      });
      onReload();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    try {
      await fetch(`/api/listings/${listingId}/operations/invoices/${invoiceId}`, {
        method: 'DELETE'
      });
      toast.success('Invoice deleted');
      onReload();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoice & Receipt Uploads
          </CardTitle>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8">
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Invoice/Receipt</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Invoice Name *</Label>
                  <Input
                    value={formData.invoice_name}
                    onChange={(e) => setFormData({ ...formData, invoice_name: e.target.value })}
                    placeholder="e.g., Plumbing Repair"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-sm">Vendor Name *</Label>
                  <Input
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    placeholder="e.g., ABC Plumbing"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-sm">Amount (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.invoice_amount}
                    onChange={(e) => setFormData({ ...formData, invoice_amount: e.target.value })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-sm">Date</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-sm">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional notes"
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">Select File *</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="h-9"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleUpload} disabled={isUploading} size="sm">
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No invoices uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((invoice: ListingOperationInvoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{invoice.invoice_name}</p>
                    {invoice.invoice_amount && (
                      <Badge variant="secondary" className="text-xs">£{invoice.invoice_amount}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">{invoice.vendor_name}</p>
                  {invoice.invoice_date && invoice.invoice_date !== '' && (
                    <p className="text-xs text-gray-500">{format(parseISO(invoice.invoice_date), 'dd MMM yyyy')}</p>
                  )}
                  {invoice.description && (
                    <p className="text-xs text-gray-600 mt-1">{invoice.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-8">
                      <Download className="h-3 w-3" />
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(invoice.id)}
                    className="h-8 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DamageReportsWidget({ listingId, reports, selectedWeek, onWeekChange }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Damage Reports from Job Completions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label>Filter by Week</Label>
            <Input
              type="date"
              value={selectedWeek}
              onChange={(e) => onWeekChange(e.target.value)}
            />
          </div>
          {reports.length === 0 ? (
            <p className="text-gray-500">No damage reports for selected week</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report: DamageReport) => (
                <div key={report.id} className="border rounded p-4 space-y-2">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">{report.listing_name}</p>
                      <p className="text-sm text-gray-600">Cleaner: {report.cleaner_name}</p>
                    </div>
                    <p className="text-sm text-gray-600">{report.completion_date ? format(parseISO(report.completion_date), 'dd MMM yyyy') : 'N/A'}</p>
                  </div>
                  {report.damage_images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {report.damage_images.map((img, idx) => (
                        <img key={idx} src={img} alt="Damage" className="w-full h-24 object-cover rounded" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IssueLogWidget({ listingId, issues, onReload }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [newIssue, setNewIssue] = useState({
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    assigned_to: '',
    cost: ''
  });

  const addIssue = async () => {
    if (!newIssue.description) {
      toast.error('Description is required');
      return;
    }

    try {
      const response = await fetch(`/api/listings/${listingId}/operations/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newIssue,
          cost: newIssue.cost ? parseFloat(newIssue.cost) : null
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Issue added');
        setNewIssue({
          issue_date: format(new Date(), 'yyyy-MM-dd'),
          description: '',
          assigned_to: '',
          cost: ''
        });
        setIsAdding(false);
        onReload();
      }
    } catch (error) {
      toast.error('Failed to add issue');
    }
  };

  const resolveIssue = async (issueId: string) => {
    try {
      const response = await fetch(`/api/listings/${listingId}/operations/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      });

      if (response.ok) {
        toast.success('Issue resolved');
        onReload();
      }
    } catch (error) {
      toast.error('Failed to resolve issue');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Issue Log / Task Tracker</CardTitle>
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Issue
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isAdding && (
          <div className="mb-4 p-4 border rounded space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newIssue.issue_date}
                  onChange={(e) => setNewIssue({ ...newIssue, issue_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Cost (£)</Label>
                <Input
                  type="number"
                  value={newIssue.cost}
                  onChange={(e) => setNewIssue({ ...newIssue, cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={newIssue.description}
                onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                placeholder="Describe the issue..."
              />
            </div>
            <div>
              <Label>Assigned To</Label>
              <Input
                value={newIssue.assigned_to}
                onChange={(e) => setNewIssue({ ...newIssue, assigned_to: e.target.value })}
                placeholder="Person or company name"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addIssue} size="sm">Add Issue</Button>
              <Button onClick={() => setIsAdding(false)} variant="outline" size="sm">Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {issues.length === 0 ? (
            <p className="text-gray-500">No issues logged</p>
          ) : (
            issues.map((issue: ListingIssueLog) => (
              <div key={issue.id} className="border rounded p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={
                        issue.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        issue.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {issue.status === 'resolved' ? 'Resolved' : issue.status === 'in_progress' ? 'In Progress' : 'Open'}
                      </Badge>
                      <span className="text-sm text-gray-600">{issue.issue_date ? format(parseISO(issue.issue_date), 'dd MMM yyyy') : 'N/A'}</span>
                    </div>
                    <p className="mt-2 font-medium">{issue.description}</p>
                    {issue.assigned_to && <p className="text-sm text-gray-600 mt-1">Assigned: {issue.assigned_to}</p>}
                    {issue.cost && <p className="text-sm font-semibold mt-1">Cost: £{issue.cost.toFixed(2)}</p>}
                  </div>
                  {issue.status !== 'resolved' && (
                    <Button onClick={() => resolveIssue(issue.id)} size="sm" variant="outline">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ChangelogWidget({ changelog }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        {changelog.length === 0 ? (
          <p className="text-gray-500">No activity logged</p>
        ) : (
          <div className="space-y-3">
            {changelog.map((entry: ListingOperationChangelog) => (
              <div key={entry.id} className="flex gap-3 pb-3 border-b last:border-0">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="font-medium">{entry.description}</p>
                  <p className="text-sm text-gray-600">
                    {entry.changed_by_name} • {entry.created_at ? format(parseISO(entry.created_at), 'dd MMM yyyy, HH:mm') : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

