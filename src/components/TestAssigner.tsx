import React, { useState, useEffect, useMemo } from 'react';
import { Users, BookOpen, RefreshCw, Search, ChevronDown, ChevronRight, CheckSquare, Square, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchUsers, fetchSubjects, fetchSubjectTests, assignCurriculums, unassignCurriculums, isTrainualConfigured } from '../services/trainualService';

interface User {
  id: number;
  name: string;
  email: string;
  status: string;
  roles: string[];
  assignedSubjectIds: Record<number, boolean>;
}

interface Subject {
  id: number;
  title: string;
  testCount: number;
  tests: { id: number; name: string }[];
  category?: string; // Auto-detected category (e.g., "Cantina Server", "OAK Bartender")
}

type FilterCategory = {
  id: string;
  label: string;
  count: number;
};

export default function TestAssigner() {
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'user' | 'subject'>('user');
  
  // Simplified filters
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Expanded states
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    if (!isTrainualConfigured()) {
      showToast('Trainual password not configured. Add TRAINUAL_PASSWORD to your .env file.', 'error');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usersData, subjectsData] = await Promise.all([
        fetchUsers(),
        fetchSubjects()
      ]);

      // Process subjects and auto-detect categories
      const testSubjects: Subject[] = [];
      for (const s of subjectsData) {
        if ((s.surveys_count || 0) > 0) {
          const testsData = await fetchSubjectTests(s.id);
          const title = s.title || 'Untitled';
          
          // Auto-detect category from title
          let category = 'Other';
          const titleLower = title.toLowerCase();
          
          // Location + Role combinations
          if (titleLower.includes('cantina')) {
            if (titleLower.includes('server') || titleLower.includes('service')) category = 'Cantina Server';
            else if (titleLower.includes('bartender') || titleLower.includes('bar')) category = 'Cantina Bartender';
            else if (titleLower.includes('host')) category = 'Cantina Host';
            else category = 'Cantina General';
          } else if (titleLower.includes('oak')) {
            if (titleLower.includes('server') || titleLower.includes('service')) category = 'OAK Server';
            else if (titleLower.includes('bartender') || titleLower.includes('bar')) category = 'OAK Bartender';
            else if (titleLower.includes('host')) category = 'OAK Host';
            else category = 'OAK General';
          } else if (titleLower.includes('white buffalo') || titleLower.includes('wb')) {
            category = 'White Buffalo';
          } else if (titleLower.includes('beer') || titleLower.includes('wine')) {
            category = 'Beer & Wine Knowledge';
          } else if (titleLower.includes('handbook') || titleLower.includes('employee')) {
            category = 'Company Policies';
          }
          
          testSubjects.push({
            id: s.id,
            title,
            testCount: s.surveys_count || 0,
            tests: Array.isArray(testsData) ? testsData.map((t: any) => ({ id: t.id, name: t.name || 'Unnamed Test' })) : [],
            category
          });
        }
      }
      testSubjects.sort((a, b) => a.title.localeCompare(b.title));

      // Process users
      const userData: User[] = [];
      usersData.forEach((u: any) => {
        if (u.status === 'archived') return;
        const assignedSubjectIds: Record<number, boolean> = {};
        (u.curriculums_assigned || []).forEach((c: any) => {
          assignedSubjectIds[c.id] = true;
        });
        userData.push({
          id: u.id,
          name: u.name || '',
          email: u.email || '',
          status: u.status || '',
          roles: (u.roles_assigned || []).map((r: any) => r.name),
          assignedSubjectIds
        });
      });
      userData.sort((a, b) => a.name.localeCompare(b.name));

      setUsers(userData);
      setSubjects(testSubjects);
    } catch (error: any) {
      showToast(`Failed to load data: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-detect available categories from subjects
  const availableCategories = useMemo((): FilterCategory[] => {
    const categoryMap = new Map<string, number>();
    subjects.forEach(s => {
      const cat = s.category || 'Other';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
    return Array.from(categoryMap.entries())
      .map(([id, count]) => ({ id, label: id, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [subjects]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (search) {
        const h = `${u.name} ${u.email} ${u.roles.join(' ')}`.toLowerCase();
        if (!h.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [users, search]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCategories.size > 0 && !selectedCategories.has(s.category || 'Other')) return false;
      return true;
    });
  }, [subjects, search, selectedCategories]);

  const stats = useMemo(() => {
    const withAssignments = users.filter(u => Object.keys(u.assignedSubjectIds).length > 0).length;
    return {
      totalUsers: users.length,
      totalSubjects: subjects.length,
      assigned: withAssignments,
      unassigned: users.length - withAssignments
    };
  }, [users, subjects]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategories(new Set());
  };

  const toggleCategory = (categoryId: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(categoryId)) {
      newSet.delete(categoryId);
    } else {
      newSet.add(categoryId);
    }
    setSelectedCategories(newSet);
  };

  const toggleUserCard = (id: number) => {
    const newSet = new Set(expandedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedUsers(newSet);
  };

  const toggleSubjectCard = (id: number) => {
    const newSet = new Set(expandedSubjects);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedSubjects(newSet);
  };

  const assignToUser = async (userId: number, subjectIds: number[]) => {
    try {
      const result = await assignCurriculums(userId, subjectIds);
      if (result !== null) {
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            const newAssigned = { ...u.assignedSubjectIds };
            subjectIds.forEach(id => newAssigned[id] = true);
            return { ...u, assignedSubjectIds: newAssigned };
          }
          return u;
        }));
        showToast(`Assigned ${subjectIds.length} subject(s)`, 'success');
        return true;
      }
      throw new Error('Failed to assign');
    } catch (e: any) {
      showToast(e.message, 'error');
      return false;
    }
  };

  const unassignFromUser = async (userId: number, subjectIds: number[]) => {
    try {
      const result = await unassignCurriculums(userId, subjectIds);
      if (result !== null) {
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            const newAssigned = { ...u.assignedSubjectIds };
            subjectIds.forEach(id => delete newAssigned[id]);
            return { ...u, assignedSubjectIds: newAssigned };
          }
          return u;
        }));
        showToast(`Unassigned ${subjectIds.length} subject(s)`, 'success');
        return true;
      }
      throw new Error('Failed to unassign');
    } catch (e: any) {
      showToast(e.message, 'error');
      return false;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border/60 bg-card/50 backdrop-blur-sm flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-border/60">
          <h2 className="text-lg font-bold text-foreground">Test Assignments</h2>
          <p className="text-xs text-muted-foreground mt-1">Three Points Hospitality</p>
        </div>
        
        <div className="p-4 flex-1">
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Search</h3>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subjects or users..."
                className="w-full pl-9 pr-3 py-2 bg-background border border-border/60 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">View Mode</h3>
            <div className="space-y-1">
              <button
                onClick={() => setMode('user')}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  mode === 'user' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  By Employee
                </div>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full", mode === 'user' ? "bg-primary/20" : "bg-muted")}>
                  {users.length}
                </span>
              </button>
              <button
                onClick={() => setMode('subject')}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  mode === 'subject' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  By Subject
                </div>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full", mode === 'subject' ? "bg-primary/20" : "bg-muted")}>
                  {subjects.length}
                </span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={loadData}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border/60"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                Refresh Data
              </button>
              {(search || selectedCategories.size > 0) && (
                <button
                  onClick={clearFilters}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border/60"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Loading Trainual data...</p>
          </div>
        )}

        {!isTrainualConfigured() && !loading && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8">
            <div className="max-w-md text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Trainual Not Connected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">TRAINUAL_PASSWORD</code> to the <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">.env</code> file and rebuild to enable the Test Assigner.
              </p>
              <div className="bg-muted/50 border border-border/60 rounded-lg p-4 text-left text-xs font-mono text-muted-foreground">
                <div>TRAINUAL_PASSWORD=your_password_here</div>
              </div>
            </div>
          </div>
        )}

        <div className="p-8 border-b border-border/60 bg-card/30">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <span className="clerk-inspired-badge bg-primary/10 text-primary border-primary/20 backdrop-blur-sm mb-6 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium">
              <Users className="h-4 w-4 mr-2" />
              Test Assigner
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              {mode === 'user' ? 'Manage Employees' : 'Manage Test Subjects'}
            </h2>
            <p className="text-lg text-muted-foreground">
              {mode === 'user' ? 'Manage test subject assignments per employee' : 'Assign a subject to multiple employees at once'}
            </p>
          </div>

          {/* Category Filter Chips - Only show in Subject mode */}
          {mode === 'subject' && availableCategories.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Filter by Category</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map(cat => {
                  const isActive = selectedCategories.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                        isActive
                          ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                          : "bg-background/50 text-muted-foreground border-border/60 hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {cat.label}
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                        isActive ? "bg-primary/20" : "bg-muted"
                      )}>
                        {cat.count}
                      </span>
                      {isActive && <X className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4">
            <div className="enterprise-metric-card p-4 rounded-xl">
              <div className="text-3xl font-bold text-foreground">{stats.totalUsers}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">Total Employees</div>
            </div>
            <div className="enterprise-metric-card p-4 rounded-xl">
              <div className="text-3xl font-bold text-foreground">{stats.totalSubjects}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">Test Subjects</div>
            </div>
            <div className="enterprise-metric-card p-4 rounded-xl">
              <div className="text-3xl font-bold text-foreground">{stats.assigned}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">With Assignments</div>
            </div>
            <div className="enterprise-metric-card p-4 rounded-xl">
              <div className="text-3xl font-bold text-foreground">{stats.unassigned}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">No Assignments</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              {mode === 'user' ? 'Employees' : 'Test Subjects'}
            </h2>
            <span className="text-sm text-muted-foreground">
              {mode === 'user' ? `${filteredUsers.length} employees` : `${filteredSubjects.length} subjects`}
            </span>
          </div>

          <div className="space-y-3">
            {mode === 'user' ? (
              filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No employees match your filters.</div>
              ) : (
                filteredUsers.map(user => {
                  const isExpanded = expandedUsers.has(user.id);
                  const assignedCount = Object.keys(user.assignedSubjectIds).length;
                  
                  return (
                    <div key={user.id} className="enterprise-card rounded-xl overflow-hidden transition-all duration-200">
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/30"
                        onClick={() => toggleUserCard(user.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {user.roles.length > 0 && (
                            <span className="px-2.5 py-1 rounded-md bg-secondary/10 text-secondary-foreground text-xs font-medium border border-secondary/20">
                              {user.roles[0]}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{assignedCount} assigned</span>
                          <ChevronRight className={cn("w-5 h-5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 border-t border-border/60 bg-background/50">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Test Subjects ({subjects.length} available)
                          </div>
                          <div className="space-y-2">
                            {subjects.map(subject => {
                              const isAssigned = !!user.assignedSubjectIds[subject.id];
                              return (
                                <div key={subject.id} className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border/60 hover:border-primary/30 transition-colors">
                                  <button
                                    onClick={() => isAssigned ? unassignFromUser(user.id, [subject.id]) : assignToUser(user.id, [subject.id])}
                                    className={cn(
                                      "w-10 h-5 rounded-full relative transition-colors border-none outline-none",
                                      isAssigned ? "bg-primary" : "bg-muted"
                                    )}
                                  >
                                    <div className={cn(
                                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                                      isAssigned && "translate-x-5"
                                    )} />
                                  </button>
                                  <div>
                                    <div className="text-sm font-medium text-foreground">{subject.title}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {subject.tests.map(t => t.name).join(', ') || 'No tests listed'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="flex gap-3 mt-6">
                            <button
                              onClick={() => {
                                const unassigned = subjects.filter(s => !user.assignedSubjectIds[s.id]).map(s => s.id);
                                if (unassigned.length) assignToUser(user.id, unassigned);
                              }}
                              className="px-4 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                            >
                              Assign All ({subjects.length - assignedCount} unassigned)
                            </button>
                            <button
                              onClick={() => {
                                const assigned = Object.keys(user.assignedSubjectIds).map(Number);
                                if (assigned.length && confirm(`Unassign all ${assigned.length} subjects from ${user.name}?`)) {
                                  unassignFromUser(user.id, assigned);
                                }
                              }}
                              className="px-4 py-2 bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-lg text-sm font-medium hover:bg-rose-500/20 transition-colors"
                            >
                              Unassign All ({assignedCount} assigned)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            ) : (
              filteredSubjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No subjects match your filters.</div>
              ) : (
                filteredSubjects.map(subject => {
                  const isExpanded = expandedSubjects.has(subject.id);
                  const assignedUsers = users.filter(u => u.assignedSubjectIds[subject.id]);
                  
                  return (
                    <div key={subject.id} className="enterprise-card rounded-xl overflow-hidden transition-all duration-200">
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/30"
                        onClick={() => toggleSubjectCard(subject.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20",
                            /cantina/i.test(subject.title) ? "border-l-4 border-l-teal-400" :
                            /oak/i.test(subject.title) ? "border-l-4 border-l-orange-400" : "border-l-4 border-l-gray-800"
                          )}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{subject.title}</div>
                            <div className="text-xs text-muted-foreground">{subject.testCount} tests • ID {subject.id}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="px-2.5 py-1 rounded-md bg-secondary/10 text-secondary-foreground text-xs font-medium border border-secondary/20">
                            {assignedUsers.length} / {users.length} assigned
                          </span>
                          <ChevronRight className={cn("w-5 h-5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 border-t border-border/60 bg-background/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
                            {users.map(user => {
                              const isAssigned = !!user.assignedSubjectIds[subject.id];
                              return (
                                <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border/60 hover:border-primary/30 transition-colors">
                                  <button
                                    onClick={() => isAssigned ? unassignFromUser(user.id, [subject.id]) : assignToUser(user.id, [subject.id])}
                                    className="text-primary focus:outline-none"
                                  >
                                    {isAssigned ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
                                    {user.roles.length > 0 && (
                                      <div className="text-[10px] text-muted-foreground truncate">{user.roles[0]}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="flex gap-3 mt-6">
                            <button
                              onClick={() => {
                                const unassigned = users.filter(u => !u.assignedSubjectIds[subject.id]).map(u => u.id);
                                if (unassigned.length && confirm(`Assign this subject to all ${unassigned.length} unassigned employees?`)) {
                                  Promise.all(unassigned.map(uid => assignToUser(uid, [subject.id])));
                                }
                              }}
                              className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                            >
                              Assign to All Employees
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right-8 fade-in duration-300">
          <div className={cn(
            "px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3",
            toast.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
            toast.type === 'error' ? "bg-rose-50 border-rose-200 text-rose-800" :
            "bg-blue-50 border-blue-200 text-blue-800"
          )}>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
