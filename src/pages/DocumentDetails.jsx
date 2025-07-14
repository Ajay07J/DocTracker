import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  User,
  Mail,
  Phone,
  Briefcase,
  Shield,
  MessageSquare,
  Send,
  Calendar,
  Edit3,
  Check,
  X,
  Activity,
  Plus,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  ShieldX,
  Trash2,
  Lock,
  Unlock
} from 'lucide-react'
import { format } from 'date-fns'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const DocumentDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [document, setDocument] = useState(null)
  const [signatories, setSignatories] = useState([])
  const [comments, setComments] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [editingSignatory, setEditingSignatory] = useState(null)
  const [approvingDocument, setApprovingDocument] = useState(false)
  const [deletingDocument, setDeletingDocument] = useState(false)

  useEffect(() => {
    if (id) {
      fetchDocumentDetails()
    }
  }, [id])

  const fetchDocumentDetails = async () => {
    try {
      setLoading(true)

      // Fetch document with creator info
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select(`
          *,
          created_by_user:users!created_by(full_name, role)
        `)
        .eq('id', id)
        .single()

      if (docError) throw docError

      // Fetch signatories
      const { data: sigData, error: sigError } = await supabase
        .from('document_signatories')
        .select('*')
        .eq('document_id', id)
        .order('order_index')

      if (sigError) throw sigError

      // Fetch comments with user info
      const { data: commentsData, error: commentsError } = await supabase
        .from('document_comments')
        .select(`
          *,
          user:users(full_name, role)
        `)
        .eq('document_id', id)
        .order('created_at', { ascending: false })

      if (commentsError) throw commentsError

      // Fetch activity with user info
      const { data: activityData, error: activityError } = await supabase
        .from('document_activity')
        .select(`
          *,
          user:users(full_name, role)
        `)
        .eq('document_id', id)
        .order('created_at', { ascending: false })

      if (activityError) throw activityError

      setDocument(docData)
      setSignatories(sigData)
      setComments(commentsData)
      setActivity(activityData)
    } catch (error) {
      console.error('Error fetching document details:', error)
      toast.error('Failed to load document details')
    } finally {
      setLoading(false)
    }
  }

  const updateSignatureStatus = async (signatoryId, isSigned, notes = '') => {
    try {
      const { error } = await supabase
        .from('document_signatories')
        .update({ 
          is_signed: isSigned, 
          signed_at: isSigned ? new Date().toISOString() : null,
          notes: notes
        })
        .eq('id', signatoryId)

      if (error) throw error

      // Update local state
      setSignatories(prev => 
        prev.map(sig => 
          sig.id === signatoryId 
            ? { ...sig, is_signed: isSigned, signed_at: isSigned ? new Date().toISOString() : null, notes }
            : sig
        )
      )

      // Check if all signatories are signed
      const updatedSignatories = signatories.map(sig => 
        sig.id === signatoryId 
          ? { ...sig, is_signed: isSigned }
          : sig
      )
      const allSigned = updatedSignatories.every(sig => sig.is_signed)

      // Update document status if all signatures are complete
      if (allSigned && document.admin_approved !== false) {
        await supabase
          .from('documents')
          .update({ status: 'completed' })
          .eq('id', id)
        
        setDocument(prev => ({ ...prev, status: 'completed' }))
      }

      // Log activity
      await supabase
        .from('document_activity')
        .insert([{
          document_id: id,
          user_id: user.id,
          action: isSigned ? 'signature_added' : 'signature_removed',
          description: `Signatory ${isSigned ? 'signed' : 'unsigned'} the document`
        }])

      toast.success(`Signature ${isSigned ? 'added' : 'removed'} successfully`)
      fetchDocumentDetails() // Refresh to get updated activity
    } catch (error) {
      console.error('Error updating signature status:', error)
      toast.error('Failed to update signature status')
    }
  }

  const handleAdminApproval = async (approved) => {
    if (approvingDocument) return
    
    try {
      setApprovingDocument(true)
      
      const updateData = {
        admin_approved: approved,
        admin_approved_by: user.id,
        admin_approved_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', id)

      if (error) throw error

      // Log activity
      await supabase
        .from('document_activity')
        .insert([{
          document_id: id,
          user_id: user.id,
          action: approved ? 'admin_approved' : 'admin_rejected',
          description: `Document ${approved ? 'approved' : 'rejected'} by admin`
        }])

      setDocument(prev => ({ ...prev, ...updateData }))
      toast.success(`Document ${approved ? 'approved' : 'rejected'} successfully`)
      fetchDocumentDetails() // Refresh to get updated activity
    } catch (error) {
      console.error('Error updating admin approval:', error)
      toast.error('Failed to update admin approval')
    } finally {
      setApprovingDocument(false)
    }
  }

  const handleDeleteDocument = async () => {
    if (deletingDocument) return

    // Confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${document.name}"?\n\nThis action cannot be undone and will permanently remove:\n• The document and all its data\n• All signatures and comments\n• Complete activity history\n\nType "DELETE" to confirm.`
    )
    
    if (!confirmDelete) return

    const secondConfirm = window.prompt(
      'To confirm deletion, please type "DELETE" (all capitals):'
    )
    
    if (secondConfirm !== 'DELETE') {
      toast.error('Deletion cancelled - confirmation text did not match')
      return
    }

    try {
      setDeletingDocument(true)

      // Delete file from storage if exists
      if (document.file_url) {
        const fileName = document.file_url.split('/').pop()
        await supabase.storage
          .from('documents')
          .remove([`${document.created_by}/${fileName}`])
      }

      // Delete related records (cascade should handle this, but being explicit)
      await supabase.from('document_comments').delete().eq('document_id', id)
      await supabase.from('document_activity').delete().eq('document_id', id)
      await supabase.from('document_signatories').delete().eq('document_id', id)
      
      // Finally delete the document
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Document deleted successfully')
      navigate('/dashboard')
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    } finally {
      setDeletingDocument(false)
    }
  }

  const addComment = async () => {
    if (!newComment.trim()) return

    try {
      setSubmittingComment(true)

      const { data, error } = await supabase
        .from('document_comments')
        .insert([{
          document_id: id,
          user_id: user.id,
          comment: newComment.trim()
        }])
        .select(`
          *,
          user:users(full_name, role)
        `)
        .single()

      if (error) throw error

      // Log activity
      await supabase
        .from('document_activity')
        .insert([{
          document_id: id,
          user_id: user.id,
          action: 'comment_added',
          description: 'Added a comment'
        }])

      setComments(prev => [data, ...prev])
      setNewComment('')
      toast.success('Comment added successfully')
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const getStatusBadge = (status) => {
    const baseClasses = "px-4 py-2 rounded-full text-sm font-semibold tracking-wide"
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-amber-100 text-amber-800 border border-amber-200`
      case 'in_progress':
        return `${baseClasses} bg-blue-100 text-blue-800 border border-blue-200`
      case 'completed':
        return `${baseClasses} bg-emerald-100 text-emerald-800 border border-emerald-200`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`
    }
  }

  const getSignatureProgress = () => {
    if (!signatories.length) return 0
    const completedSignatures = signatories.filter(sig => sig.is_signed).length
    return Math.round((completedSignatures / signatories.length) * 100)
  }

  const downloadFile = () => {
    if (document?.file_url) {
      window.open(document.file_url, '_blank')
    }
  }

  const canUserDelete = () => {
    return profile?.role === 'admin' || document?.created_by === user?.id
  }

  const isDocumentLocked = () => {
    return document?.requires_admin_approval && document?.admin_approved === false
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 font-medium">Loading document details...</p>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Document Not Found</h3>
          <p className="text-gray-600 mb-6">The document you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Professional Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="group flex items-center text-gray-600 hover:text-gray-900 mb-4 sm:mb-0 transition-all duration-200 hover:translate-x-1 font-medium"
            >
              <ArrowLeft className="h-5 w-5 mr-2 transition-transform group-hover:-translate-x-1" />
              Return to Dashboard
            </button>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => navigate('/create-document')}
                className="w-full sm:w-auto bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 hover:border-gray-400 px-4 py-2 rounded-lg flex items-center justify-center transition-all duration-200 font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Document
              </button>
              
              {document.file_url && (
                <button
                  onClick={downloadFile}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-all duration-200 font-medium shadow-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </button>
              )}

              {canUserDelete() && (
                <button
                  onClick={handleDeleteDocument}
                  disabled={deletingDocument}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-all duration-200 font-medium shadow-sm disabled:cursor-not-allowed"
                >
                  {deletingDocument ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {deletingDocument ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>

          {/* Document Header Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 mb-6 lg:mb-0 lg:pr-8">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 leading-tight">
                      {document.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        <span>Created by {document.created_by_user?.full_name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>{format(new Date(document.created_at), 'MMMM d, yyyy')}</span>
                      </div>
                      {document.created_by_user?.role === 'admin' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                          Admin Created
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-start lg:items-end space-y-3">
                <span className={getStatusBadge(document.status)}>
                  {document.status.replace('_', ' ').toUpperCase()}
                </span>
                <div className="bg-gray-50 px-4 py-2 rounded-lg border">
                  <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Progress</div>
                  <div className="text-lg font-bold text-gray-900">{getSignatureProgress()}%</div>
                </div>
                {isDocumentLocked() && (
                  <div className="flex items-center text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-200">
                    <Lock className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">Locked</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Admin Approval Section - Enhanced */}
            {document.requires_admin_approval && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
                  <div className="flex items-center text-white">
                    <Shield className="h-6 w-6 mr-3" />
                    <h2 className="text-xl font-semibold">Administrative Approval</h2>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Current Status Display */}
                  {document.admin_approved !== null && (
                    <div className={`border-2 rounded-xl p-6 ${
                      document.admin_approved 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center mb-3">
                        {document.admin_approved ? (
                          <ShieldCheck className="h-7 w-7 text-emerald-600 mr-3" />
                        ) : (
                          <ShieldX className="h-7 w-7 text-red-600 mr-3" />
                        )}
                        <div>
                          <h3 className={`font-bold text-lg ${
                            document.admin_approved ? 'text-emerald-800' : 'text-red-800'
                          }`}>
                            {document.admin_approved ? 'Document Approved' : 'Document Rejected'}
                          </h3>
                          {document.admin_approved_at && (
                            <p className={`text-sm ${
                              document.admin_approved ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                              {document.admin_approved ? 'Approved' : 'Rejected'} on{' '}
                              {format(new Date(document.admin_approved_at), 'MMMM d, yyyy \'at\' h:mm a')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {document.admin_approved && (
                        <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-3 mt-4">
                          <p className="text-emerald-800 text-sm font-medium flex items-center">
                            <Unlock className="h-4 w-4 mr-2" />
                            Signatures are now enabled and can be collected
                          </p>
                        </div>
                      )}
                      
                      {!document.admin_approved && (
                        <div className="bg-red-100 border border-red-300 rounded-lg p-3 mt-4">
                          <p className="text-red-800 text-sm font-medium flex items-center">
                            <Lock className="h-4 w-4 mr-2" />
                            Document is locked - signatures cannot be collected until approved
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Controls - Always show for admins */}
                  {profile?.role === 'admin' ? (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <Shield className="h-6 w-6 text-blue-600 mr-3" />
                        <div>
                          <h3 className="text-lg font-bold text-blue-900">Administrative Controls</h3>
                          <p className="text-blue-700 text-sm">
                            {document.admin_approved === null 
                              ? 'Review and make a decision on this document:'
                              : 'Modify your previous decision if necessary:'
                            }
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={() => handleAdminApproval(true)}
                          disabled={approvingDocument}
                          className={`px-6 py-4 rounded-xl font-semibold flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-md ${
                            document.admin_approved === true
                              ? 'bg-emerald-600 text-white border-2 border-emerald-700 shadow-emerald-200'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-2 border-emerald-300 hover:border-emerald-400'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {approvingDocument ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                          ) : (
                            <ThumbsUp className="h-5 w-5 mr-3" />
                          )}
                          {document.admin_approved === true ? 'Currently Approved' : 'Approve Document'}
                        </button>

                        <button
                          onClick={() => handleAdminApproval(false)}
                          disabled={approvingDocument}
                          className={`px-6 py-4 rounded-xl font-semibold flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-md ${
                            document.admin_approved === false
                              ? 'bg-red-600 text-white border-2 border-red-700 shadow-red-200'
                              : 'bg-red-100 hover:bg-red-200 text-red-800 border-2 border-red-300 hover:border-red-400'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {approvingDocument ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                          ) : (
                            <ThumbsDown className="h-5 w-5 mr-3" />
                          )}
                          {document.admin_approved === false ? 'Currently Rejected' : 'Reject Document'}
                        </button>
                      </div>

                      <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                        <p className="text-blue-800 text-sm flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span>
                            <strong>Administrative Note:</strong> You can modify your decision at any time. 
                            {document.admin_approved === false && ' Rejected documents will remain locked until approved.'}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    // Non-admin users
                    <div className="text-center py-8">
                      {document.admin_approved === null ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8">
                          <Clock className="mx-auto h-16 w-16 text-amber-500 mb-4" />
                          <h3 className="text-xl font-semibold text-amber-800 mb-2">Pending Administrative Review</h3>
                          <p className="text-amber-700 max-w-md mx-auto">
                            This document requires administrative approval before signature collection can begin. 
                            Please wait for an administrator to review and approve this document.
                          </p>
                        </div>
                      ) : document.admin_approved ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8">
                          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
                          <h3 className="text-xl font-semibold text-emerald-800 mb-2">Document Approved</h3>
                          <p className="text-emerald-700 max-w-md mx-auto">
                            This document has been approved by an administrator. Signatures can now be collected from the designated signatories.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
                          <X className="mx-auto h-16 w-16 text-red-500 mb-4" />
                          <h3 className="text-xl font-semibold text-red-800 mb-2">Document Rejected</h3>
                          <p className="text-red-700 max-w-md mx-auto">
                            This document has been rejected by an administrator and cannot proceed. 
                            Signature collection is disabled until the document is approved.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Document Information */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <div className="flex items-center text-white">
                  <FileText className="h-6 w-6 mr-3" />
                  <h2 className="text-xl font-semibold">Document Information</h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {document.description && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Description</h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-700 leading-relaxed">{document.description}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Current Status</h3>
                    <span className={getStatusBadge(document.status)}>
                      {document.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Attached File</h3>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-700 text-sm font-medium">{document.file_name}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Date Created</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-700 text-sm font-medium">
                        {format(new Date(document.created_at), 'MMMM d, yyyy \'at\' h:mm a')}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Last Updated</h3>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-700 text-sm font-medium">
                        {format(new Date(document.updated_at), 'MMMM d, yyyy \'at\' h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Signatories Section - Conditional based on approval */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-white">
                    <Users className="h-6 w-6 mr-3" />
                    <h2 className="text-xl font-semibold">
                      Signature Collection ({signatories.filter(s => s.is_signed).length}/{signatories.length} completed)
                    </h2>
                  </div>
                  <div className="text-white text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
                    {getSignatureProgress()}%
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Locked Message for Rejected Documents */}
                {isDocumentLocked() && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6">
                    <div className="flex items-center mb-3">
                      <Lock className="h-6 w-6 text-red-600 mr-3" />
                      <h3 className="text-lg font-semibold text-red-800">Signature Collection Disabled</h3>
                    </div>
                    <p className="text-red-700 mb-4">
                      This document has been rejected by an administrator. Signature collection is disabled until the document is approved.
                    </p>
                    <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                      <p className="text-red-800 text-sm font-medium">
                        ⚠️ All signature options are temporarily unavailable
                      </p>
                    </div>
                  </div>
                )}

                {signatories.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Signatories Assigned</h3>
                    <p className="text-gray-600 max-w-md mx-auto">No signatories have been added to this document. Contact the document creator to add signatories.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Progress Bar */}
                    <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-4 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${getSignatureProgress()}%` }}
                      />
                    </div>

                    {/* Signatories List */}
                    <div className="space-y-4">
                      {signatories.map((signatory, index) => (
                        <div 
                          key={signatory.id} 
                          className={`border-2 rounded-xl p-6 transition-all duration-200 ${
                            signatory.is_signed 
                              ? 'border-emerald-200 bg-emerald-50' 
                              : isDocumentLocked()
                              ? 'border-gray-200 bg-gray-100 opacity-75'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                signatory.is_signed 
                                  ? 'bg-emerald-500 text-white' 
                                  : isDocumentLocked()
                                  ? 'bg-gray-400 text-white'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                {signatory.is_signed ? '✓' : index + 1}
                              </div>
                              
                              <div>
                                <h3 className="font-semibold text-gray-900 text-lg">{signatory.name}</h3>
                                {signatory.position && (
                                  <p className="text-sm text-gray-600 font-medium">{signatory.position}</p>
                                )}
                                <div className="flex items-center space-x-4 mt-2">
                                  {signatory.email && (
                                    <div className="flex items-center text-xs text-gray-500">
                                      <Mail className="h-3 w-3 mr-1" />
                                      {signatory.email}
                                    </div>
                                  )}
                                  {signatory.phone && (
                                    <div className="flex items-center text-xs text-gray-500">
                                      <Phone className="h-3 w-3 mr-1" />
                                      {signatory.phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              {signatory.is_signed ? (
                                <div className="flex items-center text-emerald-600">
                                  <CheckCircle className="h-6 w-6 mr-3" />
                                  <div className="text-right">
                                    <div className="text-sm font-semibold">Signature Completed</div>
                                    {signatory.signed_at && (
                                      <div className="text-xs text-gray-500">
                                        {format(new Date(signatory.signed_at), 'MMM d, h:mm a')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : isDocumentLocked() ? (
                                <div className="flex items-center text-gray-500">
                                  <Lock className="h-5 w-5 mr-2" />
                                  <span className="text-sm font-medium">Locked</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => updateSignatureStatus(signatory.id, true)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-semibold shadow-sm"
                                  >
                                    Mark as Signed
                                  </button>
                                </div>
                              )}
                              
                              {signatory.is_signed && !isDocumentLocked() && (
                                <button
                                  onClick={() => updateSignatureStatus(signatory.id, false)}
                                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm font-medium"
                                >
                                  Undo
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {signatory.notes && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-blue-800 text-sm">
                                <strong>Notes:</strong> {signatory.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                <div className="flex items-center text-white">
                  <MessageSquare className="h-6 w-6 mr-3" />
                  <h2 className="text-xl font-semibold">Discussion & Comments ({comments.length})</h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Add Comment */}
                <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">Add a Comment</h3>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts, ask questions, or provide updates..."
                    rows={4}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all duration-200"
                  />
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={addComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-3 rounded-lg flex items-center disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
                    >
                      {submittingComment ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Post Comment
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Comments Yet</h3>
                      <p className="text-gray-600 max-w-md mx-auto">Start the conversation by adding the first comment above.</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="border-2 border-gray-200 rounded-xl p-6 bg-white hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                              <User className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{comment.user?.full_name}</h4>
                              <p className="text-xs text-gray-500">
                                {format(new Date(comment.created_at), 'MMMM d, yyyy \'at\' h:mm a')}
                              </p>
                            </div>
                          </div>
                          {comment.user?.role === 'admin' && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-semibold">
                              Administrator
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 ml-14 leading-relaxed">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Professional Sidebar */}
          <div className="space-y-6">
            {/* Quick Statistics */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Document Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Total Signatories:</span>
                  <span className="font-bold text-gray-900 text-lg">{signatories.length}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Completed:</span>
                  <span className="font-bold text-emerald-600 text-lg">
                    {signatories.filter(s => s.is_signed).length}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Pending:</span>
                  <span className="font-bold text-amber-600 text-lg">
                    {signatories.filter(s => !s.is_signed).length}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Progress:</span>
                  <span className="font-bold text-blue-600 text-lg">{getSignatureProgress()}%</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 font-medium">Comments:</span>
                  <span className="font-bold text-gray-900 text-lg">{comments.length}</span>
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Activity Timeline
              </h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No activity recorded yet</p>
                ) : (
                  activity.map((item) => (
                    <div key={item.id} className="flex items-start space-x-4 pb-4 border-b border-gray-100 last:border-b-0">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-medium">
                          <span className="font-semibold">{item.user?.full_name}</span>{' '}
                          {item.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(item.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentDetails