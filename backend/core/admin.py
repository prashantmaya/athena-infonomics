from django.contrib import admin
from core.models import Program, UserProfile, Agent, Supervisor, CaseTypeDefinition, Case, CaseAssignment, SyncSession, Activity, SyncState, ExternalEvent, QualityIssue

@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ('code', 'name')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'program', 'role')

@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ('program', 'external_id', 'name')

@admin.register(Supervisor)
class SupervisorAdmin(admin.ModelAdmin):
    list_display = ('program', 'name')

@admin.register(CaseTypeDefinition)
class CaseTypeDefinitionAdmin(admin.ModelAdmin):
    list_display = ('program', 'slug', 'name')

@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ('program', 'case_type', 'title')

@admin.register(CaseAssignment)
class CaseAssignmentAdmin(admin.ModelAdmin):
    list_display = ('case', 'agent')

@admin.register(SyncSession)
class SyncSessionAdmin(admin.ModelAdmin):
    list_display = ('program', 'agent', 'status')

@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ('program', 'case', 'agent', 'sync_session', 'client_activity_id', 'activity_type')

@admin.register(SyncState)
class SyncStateAdmin(admin.ModelAdmin):
    list_display = ('program', 'agent', 'updates_token')

@admin.register(ExternalEvent)
class ExternalEventAdmin(admin.ModelAdmin):
    list_display = ('program', 'case', 'source', 'external_event_id', 'event_type')

@admin.register(QualityIssue)
class QualityIssueAdmin(admin.ModelAdmin):
    list_display = ('program', 'case', 'issue_type', 'severity')

