import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { ChevronRight, Eye, GitMerge, AlertCircle, Check, X, Building2, User, Mail, Phone, MapPin, Edit2, Save } from 'lucide-react';
import { PrivacyText } from '../ui/PrivacyMask';

type DuplicateType = 'person' | 'organization';

interface ConflictField {
    field: string;
    label: string;
    values: string[];
}

interface DuplicateGroup {
    type: DuplicateType;
    records: any[];
    conflicts: ConflictField[];
    reason: string;
}

export default function MergeDuplicatesView() {
    const {
        contacts,
        companies,
        deals,
        activities,
        updateContact,
        deleteContact,
        updateCompany,
        deleteCompany,
        updateDeal,
        updateActivity
    } = useCRM();
    const [viewingGroup, setViewingGroup] = useState<DuplicateGroup | null>(null);
    const [primaryRecord, setPrimaryRecord] = useState<any | null>(null);
    const [secondaryRecord, setSecondaryRecord] = useState<any | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [editedRecords, setEditedRecords] = useState<Record<string, any>>({});
    const [isMerging, setIsMerging] = useState(false);

    // Normalize email for comparison
    const normalizeEmail = (email: string) => {
        return email.toLowerCase().trim();
    };

    // Normalize phone for comparison (remove spaces, dashes, parentheses)
    const normalizePhone = (phone: string) => {
        return phone.replace(/[\s\-\(\)]/g, '');
    };

    // Find potential duplicates for PEOPLE (Contacts)
    const findPersonDuplicates = useMemo(() => {
        const groups: DuplicateGroup[] = [];
        const processed = new Set<string>();

        contacts.forEach(contact => {
            if (processed.has(contact.id)) return;

            const potentialDuplicates = contacts.filter(c => {
                if (c.id === contact.id || processed.has(c.id)) return false;

                const conflicts: ConflictField[] = [];

                // Rule 1: Same email (both filled)
                if (contact.email && c.email && normalizeEmail(contact.email) === normalizeEmail(c.email)) {
                    conflicts.push({
                        field: 'email',
                        label: 'E-mail',
                        values: [contact.email, c.email]
                    });
                }

                // Rule 2: Same phone (both filled)
                if (contact.phone && c.phone && normalizePhone(contact.phone) === normalizePhone(c.phone)) {
                    conflicts.push({
                        field: 'phone',
                        label: 'Telefone',
                        values: [contact.phone, c.phone]
                    });
                }

                // Rule 3: Same name + same company (both filled)
                if (contact.name && c.name && contact.companyId && c.companyId) {
                    if (contact.name.toLowerCase().trim() === c.name.toLowerCase().trim() &&
                        contact.companyId === c.companyId) {
                        conflicts.push({
                            field: 'name_company',
                            label: 'Nome + Organização',
                            values: [contact.name, c.name]
                        });
                    }
                }

                return conflicts.length > 0;
            });

            if (potentialDuplicates.length > 0) {
                const allRecords = [contact, ...potentialDuplicates];
                allRecords.forEach(r => processed.add(r.id));

                // Determine primary conflict reason
                let reason = 'E-mail idêntico';
                if (contact.phone && potentialDuplicates[0].phone &&
                    normalizePhone(contact.phone) === normalizePhone(potentialDuplicates[0].phone)) {
                    reason = 'Telefone idêntico';
                }
                if (contact.companyId && potentialDuplicates[0].companyId &&
                    contact.companyId === potentialDuplicates[0].companyId) {
                    reason = 'Nome + Organização idênticos';
                }

                groups.push({
                    type: 'person',
                    records: allRecords,
                    conflicts: [],
                    reason
                });
            }
        });

        return groups;
    }, [contacts]);

    // Find potential duplicates for ORGANIZATIONS (Companies)
    const findOrganizationDuplicates = useMemo(() => {
        const groups: DuplicateGroup[] = [];
        const processed = new Set<string>();

        companies.forEach(company => {
            if (processed.has(company.id)) return;

            const potentialDuplicates = companies.filter(c => {
                if (c.id === company.id || processed.has(c.id)) return false;

                // Rule 1: Same name (both filled)
                if (company.name && c.name &&
                    company.name.toLowerCase().trim() === c.name.toLowerCase().trim()) {
                    return true;
                }

                // Rule 2: Same website (both filled)
                if (company.website && c.website &&
                    company.website.toLowerCase().trim() === c.website.toLowerCase().trim()) {
                    return true;
                }

                return false;
            });

            if (potentialDuplicates.length > 0) {
                const allRecords = [company, ...potentialDuplicates];
                allRecords.forEach(r => processed.add(r.id));

                const reason = company.website && potentialDuplicates[0].website &&
                    company.website === potentialDuplicates[0].website
                    ? 'Nome + Website idênticos'
                    : 'Nome idêntico';

                groups.push({
                    type: 'organization',
                    records: allRecords,
                    conflicts: [],
                    reason
                });
            }
        });

        return groups;
    }, [companies]);

    const allDuplicates = [...findPersonDuplicates, ...findOrganizationDuplicates];

    const handleViewGroup = (group: DuplicateGroup) => {
        setViewingGroup(group);
        setPrimaryRecord(null);
        setSecondaryRecord(null);
        setEditingRecordId(null);
        setEditedRecords({});
    };

    const handleStartEdit = (record: any) => {
        setEditingRecordId(record.id);
        setEditedRecords(prev => ({
            ...prev,
            [record.id]: { ...record }
        }));
    };

    const handleCancelEdit = (recordId: string) => {
        setEditingRecordId(null);
        setEditedRecords(prev => {
            const newEdited = { ...prev };
            delete newEdited[recordId];
            return newEdited;
        });
    };

    const handleSaveEdit = async (recordId: string) => {
        const editedData = editedRecords[recordId];
        console.log('Saving edited record:', editedData);

        // Update Backend
        if (viewingGroup?.type === 'person') {
            await updateContact(recordId, editedData);
        } else if (viewingGroup?.type === 'organization') {
            await updateCompany(recordId, editedData);
        }

        // Update the viewing group with edited data locally
        if (viewingGroup) {
            const updatedRecords = viewingGroup.records.map(r =>
                r.id === recordId ? editedData : r
            );
            setViewingGroup({
                ...viewingGroup,
                records: updatedRecords
            });
        }

        setEditingRecordId(null);
    };

    const handleFieldChange = (recordId: string, field: string, value: string) => {
        setEditedRecords(prev => ({
            ...prev,
            [recordId]: {
                ...prev[recordId],
                [field]: value
            }
        }));
    };

    const getCurrentRecordData = (record: any) => {
        return editedRecords[record.id] || record;
    };

    const handleConfirmMerge = () => {
        if (!primaryRecord || !secondaryRecord) {
            alert('Selecione o registro primário e secundário');
            return;
        }
        setShowConfirmModal(true);
    };

    const handleExecuteMerge = async () => {
        if (!primaryRecord || !secondaryRecord || !viewingGroup) return;
        setIsMerging(true);

        try {
            const primaryData = getCurrentRecordData(primaryRecord);
            const secondaryData = getCurrentRecordData(secondaryRecord); // Use current data in case of unsaved edits? Or assume saved. 
            // Better use actual secondaryRecord from prop if edits not saved, but let's assume raw record for secondary since we are deleting it.

            // 1. Merge Strategy: Fill empty fields in Primary with Secondary data
            const updates: any = {};

            if (viewingGroup.type === 'person') {
                // Fields to check for Contact
                const contactFields = ['email', 'phone', 'companyId', 'role'];
                contactFields.forEach(field => {
                    if (!primaryData[field] && secondaryData[field]) {
                        updates[field] = secondaryData[field];
                    }
                });

                // Perform Update if needed
                if (Object.keys(updates).length > 0) {
                    await updateContact(primaryRecord.id, updates);
                }

                // 2. Move Related Deals
                const relatedDeals = deals.filter(d => d.contactId === secondaryRecord.id);
                for (const deal of relatedDeals) {
                    await updateDeal(deal.id, { contactId: primaryRecord.id });
                }

                // 3. Move Related Activities
                const relatedActivities = activities.filter(a => a.contactId === secondaryRecord.id);
                for (const activity of relatedActivities) {
                    await updateActivity(activity.id, { contactId: primaryRecord.id });
                }

                // 4. Delete Secondary Contact
                await deleteContact(secondaryRecord.id);

            } else if (viewingGroup.type === 'organization') {
                // Fields to check for Company
                const companyFields = ['website', 'phone', 'email', 'address'];
                companyFields.forEach(field => {
                    if (!primaryData[field] && secondaryData[field]) {
                        updates[field] = secondaryData[field];
                    }
                });

                if (Object.keys(updates).length > 0) {
                    await updateCompany(primaryRecord.id, updates);
                }

                // Move Related Deals
                const relatedDeals = deals.filter(d => d.companyId === secondaryRecord.id);
                for (const deal of relatedDeals) {
                    await updateDeal(deal.id, { companyId: primaryRecord.id });
                }

                // Move Related Contacts
                const relatedContacts = contacts.filter(c => c.companyId === secondaryRecord.id);
                for (const contact of relatedContacts) {
                    await updateContact(contact.id, { companyId: primaryRecord.id });
                }

                // Delete Secondary Company
                await deleteCompany(secondaryRecord.id);
            }

            // Success feedback
            setShowConfirmModal(false);
            setViewingGroup(null);
            setPrimaryRecord(null);
            setSecondaryRecord(null);
            setEditedRecords({});

            // Optional: Toast notification here if we had a toast system

        } catch (error) {
            console.error('Merge failed:', error);
            alert('Falha ao mesclar registros. Tente novamente.');
        } finally {
            setIsMerging(false);
        }
    };

    const getCompanyName = (id?: string) => {
        if (!id) return null;
        return companies.find(c => c.id === id)?.name;
    };

    // Render field value with privacy mask
    const renderFieldValue = (value: any, type: 'name' | 'email' | 'phone' | 'company' | 'text') => {
        if (!value) return <span className="text-muted-foreground italic">Vazio</span>;
        return <PrivacyText text={String(value)} type={type} />;
    };

    // Main listing view
    if (!viewingGroup) {
        return (
            <div className="h-full flex flex-col bg-background">
                {/* Breadcrumb */}
                <div className="px-6 pt-4 pb-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="hover:text-foreground cursor-pointer transition-colors">Contatos</span>
                        <ChevronRight size={14} />
                        <span className="text-foreground font-medium">Mesclar duplicatas</span>
                    </div>
                </div>

                {/* Header */}
                <div className="px-6 py-3 border-b border-border">
                    <h1 className="text-xl font-semibold text-foreground">Possíveis Duplicatas</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {allDuplicates.length > 0
                            ? `${allDuplicates.length} ${allDuplicates.length === 1 ? 'grupo encontrado' : 'grupos encontrados'}`
                            : 'Nenhuma duplicata detectada'
                        }
                    </p>
                </div>

                {/* List */}
                <div className="flex-1 overflow-auto px-6 py-4">
                    {allDuplicates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                                <Check size={32} className="text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-foreground font-semibold text-lg mb-2">Base limpa!</p>
                            <p className="text-sm text-muted-foreground">Nenhuma duplicata detectada</p>
                        </div>
                    ) : (
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nome Principal</th>
                                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Motivo</th>
                                        <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Registros</th>
                                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allDuplicates.map((group, idx) => (
                                        <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {group.type === 'person' ? (
                                                        <>
                                                            <User size={16} className="text-blue-500" />
                                                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Pessoa</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Building2 size={16} className="text-primary" />
                                                            <span className="text-xs font-medium text-primary dark:text-primary">Organização</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-foreground">
                                                <PrivacyText text={group.records[0].name} type="name" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle size={14} className="text-amber-500" />
                                                    <span className="text-amber-700 dark:text-amber-400 text-xs">{group.reason}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                                                    {group.records.length}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleViewGroup(group)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium transition-all"
                                                >
                                                    <Eye size={14} />
                                                    Visualizar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Detail/Merge view
    return (
        <div className="h-full flex flex-col bg-background">
            {/* Breadcrumb */}
            <div className="px-6 pt-4 pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                        className="hover:text-foreground cursor-pointer transition-colors"
                        onClick={() => setViewingGroup(null)}
                    >
                        Contatos
                    </span>
                    <ChevronRight size={14} />
                    <span
                        className="hover:text-foreground cursor-pointer transition-colors"
                        onClick={() => setViewingGroup(null)}
                    >
                        Mesclar duplicatas
                    </span>
                    <ChevronRight size={14} />
                    <span className="text-foreground font-medium">Visualizar duplicata</span>
                </div>
            </div>

            {/* Header */}
            <div className="px-6 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Possível Duplicata</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {viewingGroup.reason} • {viewingGroup.records.length} registros
                        </p>
                    </div>
                    <button
                        onClick={() => setViewingGroup(null)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Instructions */}
            <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-900/30">
                <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Como mesclar:</p>
                        <ol className="text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                            <li>Selecione qual registro será o <strong>Primário</strong> (será mantido)</li>
                            <li>Selecione qual registro será o <strong>Secundário</strong> (será eliminado)</li>
                            <li>Campos vazios no primário serão preenchidos com dados do secundário</li>
                            <li>Atividades e negócios serão transferidos para o registro primário</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* Records comparison */}
            <div className="flex-1 overflow-auto px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl mx-auto">
                    {viewingGroup.records.map((record) => {
                        const currentData = getCurrentRecordData(record);
                        const isPrimary = primaryRecord?.id === record.id;
                        const isSecondary = secondaryRecord?.id === record.id;
                        const isEditing = editingRecordId === record.id;
                        const companyName = viewingGroup.type === 'person' ? getCompanyName(currentData.companyId) : null;

                        return (
                            <div
                                key={record.id}
                                className={`
                                    bg-card rounded-lg border-2 p-6 transition-all cursor-pointer
                                    ${isPrimary ? 'border-green-500 bg-green-50 dark:bg-green-900/10' :
                                        isSecondary ? 'border-red-500 bg-red-50 dark:bg-red-900/10' :
                                            'border-border hover:border-primary/50'}
                                `}
                            >
                                {/* Edit/Save buttons */}
                                <div className="flex gap-2 mb-4">
                                    {!isEditing ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setPrimaryRecord(record);
                                                    if (secondaryRecord?.id === record.id) setSecondaryRecord(null);
                                                }}
                                                className={`
                                                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                                                    ${isPrimary
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-muted text-muted-foreground hover:bg-green-100 dark:hover:bg-green-900/30'}
                                                `}
                                            >
                                                {isPrimary ? '✓ Primário' : 'Definir como Primário'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSecondaryRecord(record);
                                                    if (primaryRecord?.id === record.id) setPrimaryRecord(null);
                                                }}
                                                className={`
                                                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                                                    ${isSecondary
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-muted text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900/30'}
                                                `}
                                            >
                                                {isSecondary ? '✓ Secundário' : 'Definir como Secundário'}
                                            </button>
                                            <button
                                                onClick={() => handleStartEdit(record)}
                                                className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all"
                                                title="Editar informações"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleSaveEdit(record.id)}
                                                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Save size={16} />
                                                Salvar
                                            </button>
                                            <button
                                                onClick={() => handleCancelEdit(record.id)}
                                                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                                            >
                                                Cancelar
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Record details */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 pb-3 border-b border-border">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                                            {record.name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-foreground text-lg">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={currentData.name || ''}
                                                        onChange={(e) => handleFieldChange(record.id, 'name', e.target.value)}
                                                        className="w-full px-2 py-1 border border-border rounded bg-background text-foreground"
                                                        placeholder="Nome"
                                                    />
                                                ) : (
                                                    renderFieldValue(currentData.name, 'name')
                                                )}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">ID: {record.id.slice(0, 8)}</p>
                                        </div>
                                    </div>

                                    {viewingGroup.type === 'person' && (
                                        <>
                                            <div className="flex items-start gap-2">
                                                <Mail size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-muted-foreground mb-0.5">E-mail</p>
                                                    {isEditing ? (
                                                        <input
                                                            type="email"
                                                            value={currentData.email || ''}
                                                            onChange={(e) => handleFieldChange(record.id, 'email', e.target.value)}
                                                            className="w-full px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                                                            placeholder="email@exemplo.com"
                                                        />
                                                    ) : (
                                                        <p className="text-sm font-medium">{renderFieldValue(currentData.email, 'email')}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <Phone size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-muted-foreground mb-0.5">Telefone</p>
                                                    {isEditing ? (
                                                        <input
                                                            type="tel"
                                                            value={currentData.phone || ''}
                                                            onChange={(e) => handleFieldChange(record.id, 'phone', e.target.value)}
                                                            className="w-full px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                                                            placeholder="+351 912 345 678"
                                                        />
                                                    ) : (
                                                        <p className="text-sm font-medium">{renderFieldValue(currentData.phone, 'phone')}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <Building2 size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-muted-foreground mb-0.5">Organização</p>
                                                    <p className="text-sm font-medium">{renderFieldValue(companyName, 'company')}</p>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {viewingGroup.type === 'organization' && (
                                        <>
                                            <div className="flex items-start gap-2">
                                                <MapPin size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-muted-foreground mb-0.5">Website</p>
                                                    {isEditing ? (
                                                        <input
                                                            type="url"
                                                            value={currentData.website || ''}
                                                            onChange={(e) => handleFieldChange(record.id, 'website', e.target.value)}
                                                            className="w-full px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                                                            placeholder="https://exemplo.com"
                                                        />
                                                    ) : (
                                                        <p className="text-sm font-medium">{renderFieldValue(currentData.website, 'text')}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <Phone size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-muted-foreground mb-0.5">Telefone</p>
                                                    {isEditing ? (
                                                        <input
                                                            type="tel"
                                                            value={currentData.phone || ''}
                                                            onChange={(e) => handleFieldChange(record.id, 'phone', e.target.value)}
                                                            className="w-full px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                                                            placeholder="+351 912 345 678"
                                                        />
                                                    ) : (
                                                        <p className="text-sm font-medium">{renderFieldValue(currentData.phone, 'phone')}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Action bar */}
            <div className="border-t border-border px-6 py-4 bg-muted/30">
                <div className="flex items-center justify-between max-w-6xl mx-auto">
                    <button
                        onClick={() => setViewingGroup(null)}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmMerge}
                        disabled={!primaryRecord || !secondaryRecord}
                        className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                    >
                        <GitMerge size={16} />
                        {!primaryRecord || !secondaryRecord
                            ? 'Selecione primário e secundário'
                            : 'Mesclar Registros'}
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-lg border border-border max-w-md w-full p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                <AlertCircle size={20} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground text-lg mb-1">Confirmar Mesclagem</h3>
                                <p className="text-sm text-muted-foreground">
                                    Esta ação não pode ser desfeita. O registro secundário será eliminado permanentemente.
                                </p>
                            </div>
                        </div>

                        <div className="bg-muted rounded-lg p-4 mb-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Registro mantido:</span>
                                <span className="font-medium text-green-600 dark:text-green-400">
                                    {primaryRecord?.name}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Registro eliminado:</span>
                                <span className="font-medium text-red-600 dark:text-red-400">
                                    {secondaryRecord?.name}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isMerging}
                                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExecuteMerge}
                                disabled={isMerging}
                                className="flex-1 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isMerging ? 'Mesclando...' : 'Confirmar Mesclagem'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
