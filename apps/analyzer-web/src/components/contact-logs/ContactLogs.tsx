import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

import {
    Phone,
    Mail,
    Users,
    Presentation,
    FileText,
    Plus,
    Edit,
    Trash2,
    Calendar,
    Clock
} from 'lucide-react';
import { contactLogService } from '../../services/contactLogService';
import type { ContactLog, ContactLogData } from '../../services/contactLogService';
import type { VenueSegment } from '../../services/genericVenueService';
import { toast } from 'sonner';

interface ContactLogsProps {
    companyId: string;
    companyName: string;
    companyType?: 'techpark' | 'coworking' | 'venue';
    venueType?: VenueSegment;
    onStatusChange?: (status: string) => void;
}

const typeIcons = {
    CALL: Phone,
    EMAIL: Mail,
    MEETING: Users,
    DEMO: Presentation,
    PROPOSAL: FileText
};

const statusColors = {
    NOT_CONTACTED: 'bg-gray-100 text-gray-800',
    CONTACTED: 'bg-blue-100 text-blue-800',
    INTERESTED: 'bg-green-100 text-green-800',
    MEETING_SCHEDULED: 'bg-purple-100 text-purple-800',
    PROPOSAL_SENT: 'bg-orange-100 text-orange-800',
    IN_PROGRESS: 'bg-amber-100 text-amber-800',
    CLOSED: 'bg-red-100 text-red-800'
};

type ApiErrorShape = {
    response?: {
        data?: {
            message?: string;
        };
    };
    message?: string;
};

const readApiErrorMessage = (error: unknown, fallback: string): string => {
    const parsedError = error as ApiErrorShape;
    return parsedError.response?.data?.message || parsedError.message || fallback;
};

export const ContactLogs: React.FC<ContactLogsProps> = ({
    companyId,
    companyType = 'techpark',
    venueType,
    onStatusChange
}) => {
    const [logs, setLogs] = useState<ContactLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [logToDelete, setLogToDelete] = useState<string | null>(null);
    const [editingLog, setEditingLog] = useState<ContactLog | null>(null);
    const [formData, setFormData] = useState<Partial<ContactLogData>>({
        type: 'CALL',
        status: 'CONTACTED',
        subject: '',
        notes: '',
        timestamp: new Date().toISOString().slice(0, 16),
        createdBy: 'Current User' // This should come from auth context
    });

    const loadContactLogs = useCallback(async () => {
        try {
            setLoading(true);
            const data =
                companyType === 'venue' && venueType
                    ? await contactLogService.getContactLogsByVenue(venueType, companyId)
                    : companyType === 'coworking'
                        ? await contactLogService.getCoworkingContactLogsByCompany(companyId)
                        : await contactLogService.getContactLogsByCompany(companyId);
            setLogs(data);
        } catch (error: unknown) {
            toast.error(readApiErrorMessage(error, 'Failed to load contact logs'));
            console.error('Error loading contact logs:', error);
        } finally {
            setLoading(false);
        }
    }, [companyId, companyType, venueType]);

    useEffect(() => {
        loadContactLogs();
    }, [loadContactLogs]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.notes || !formData.type || !formData.status) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            if (editingLog) {
                const updatePayload: Parameters<typeof contactLogService.updateContactLog>[1] = {
                    ...formData,
                    updatedBy: 'Current User',
                };
                await contactLogService.updateContactLog(editingLog.id, {
                    ...updatePayload,
                });
                toast.success('Contact log updated successfully');
            } else {
                if (companyType === 'venue' && venueType) {
                    await contactLogService.createVenueContactLog(venueType, companyId, formData as ContactLogData);
                } else if (companyType === 'coworking') {
                    await contactLogService.createCoworkingContactLog(companyId, formData as ContactLogData);
                } else {
                    await contactLogService.createContactLog(companyId, formData as ContactLogData);
                }
                toast.success('Contact log created successfully');
            }

            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            setEditingLog(null);
            resetForm();
            loadContactLogs();

            // Update company status if it changed
            if (onStatusChange && formData.status) {
                onStatusChange(formData.status);
            }
        } catch (error: unknown) {
            toast.error(readApiErrorMessage(error, 'Failed to save contact log'));
            console.error('Error saving contact log:', error);
        }
    };

    const handleEdit = (log: ContactLog) => {
        setEditingLog(log);
        setFormData({
            type: log.type,
            status: log.status,
            subject: log.subject || '',
            notes: log.notes,
            timestamp: log.timestamp ? new Date(log.timestamp).toISOString().slice(0, 16) : '',
            createdBy: log.createdBy
        });
        setIsEditDialogOpen(true);
    };

    const handleDelete = (logId: string) => {
        setLogToDelete(logId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!logToDelete) return;
        try {
            await contactLogService.deleteContactLog(logToDelete);
            toast.success('Contact log deleted successfully');
            setIsDeleteDialogOpen(false);
            setLogToDelete(null);
            loadContactLogs();
        } catch (error: unknown) {
            toast.error(readApiErrorMessage(error, 'Failed to delete contact log'));
            console.error('Error deleting contact log:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            type: 'CALL',
            status: 'CONTACTED',
            subject: '',
            notes: '',
            timestamp: new Date().toISOString().slice(0, 16),
            createdBy: 'Current User'
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Contact Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">Loading...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Contact Logs ({logs.length})</CardTitle>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Log
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Contact Log</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="type">Type</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, type: value as ContactLogData["type"] })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CALL">Call</SelectItem>
                                            <SelectItem value="EMAIL">Email</SelectItem>
                                            <SelectItem value="MEETING">Meeting</SelectItem>
                                            <SelectItem value="DEMO">Demo</SelectItem>
                                            <SelectItem value="PROPOSAL">Proposal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="status">Status</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, status: value as ContactLogData["status"] })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NOT_CONTACTED">Not Contacted</SelectItem>
                                            <SelectItem value="CONTACTED">Contacted</SelectItem>
                                            <SelectItem value="INTERESTED">Interested</SelectItem>
                                            <SelectItem value="MEETING_SCHEDULED">Meeting Scheduled</SelectItem>
                                            <SelectItem value="PROPOSAL_SENT">Proposal Sent</SelectItem>
                                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                            <SelectItem value="CLOSED">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="subject">Subject (Optional)</Label>
                                <Input
                                    id="subject"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="Brief summary of the interaction"
                                />
                            </div>

                            <div>
                                <Label htmlFor="notes">Notes <span className="text-red-500">*</span></Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Detailed notes about the interaction"
                                    rows={4}
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="timestamp">Timestamp</Label>
                                <Input
                                    id="timestamp"
                                    type="datetime-local"
                                    value={formData.timestamp}
                                    onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end space-x-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsAddDialogOpen(false);
                                        resetForm();
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">Add Log</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>

            <CardContent>
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No contact logs yet. Add your first interaction with this company.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {logs.map((log) => {
                            const TypeIcon = typeIcons[log.type as keyof typeof typeIcons];
                            return (
                                <div key={log.id} className="border rounded-lg p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-blue-100 rounded-full">
                                                <TypeIcon className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-medium">{log.type}</span>
                                                    <Badge className={statusColors[log.status as keyof typeof statusColors]}>
                                                        {log.status.replace('_', ' ')}
                                                    </Badge>
                                                </div>
                                                {log.subject && (
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {log.subject}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(log)}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(log.id)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-sm text-gray-700">{log.notes}</p>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                                        <div className="flex items-center space-x-4">
                                            <span className="flex items-center">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {formatDate(log.createdAt)}
                                            </span>
                                            <span>By: {log.createdBy}</span>
                                        </div>
                                        {log.updatedAt && (
                                            <span className="flex items-center">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                Updated: {formatDate(log.updatedAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Contact Log</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="edit-type">Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, type: value as ContactLogData["type"] })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CALL">Call</SelectItem>
                                        <SelectItem value="EMAIL">Email</SelectItem>
                                        <SelectItem value="MEETING">Meeting</SelectItem>
                                        <SelectItem value="DEMO">Demo</SelectItem>
                                        <SelectItem value="PROPOSAL">Proposal</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="edit-status">Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, status: value as ContactLogData["status"] })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NOT_CONTACTED">Not Contacted</SelectItem>
                                        <SelectItem value="CONTACTED">Contacted</SelectItem>
                                        <SelectItem value="INTERESTED">Interested</SelectItem>
                                        <SelectItem value="MEETING_SCHEDULED">Meeting Scheduled</SelectItem>
                                        <SelectItem value="PROPOSAL_SENT">Proposal Sent</SelectItem>
                                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                        <SelectItem value="CLOSED">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="edit-subject">Subject (Optional)</Label>
                            <Input
                                id="edit-subject"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                placeholder="Brief summary of the interaction"
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-notes">Notes <span className="text-red-500">*</span></Label>
                            <Textarea
                                id="edit-notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Detailed notes about the interaction"
                                rows={4}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-timestamp">Timestamp</Label>
                            <Input
                                id="edit-timestamp"
                                type="datetime-local"
                                value={formData.timestamp}
                                onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                            />
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsEditDialogOpen(false);
                                    setEditingLog(null);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">Update Log</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Contact Log</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this contact log? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete Log</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}; 
