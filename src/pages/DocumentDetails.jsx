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
  ShieldX
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
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium"
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'in_progress':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Document not found</h3>
          <p className="mt-1 text-gray-500">The document you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header with Navigation */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="group flex items-center text-gray-600 hover:text-gray-900 mb-4 sm:mb-0 transition-all duration-200 hover:translate-x-1"
            >
              <ArrowLeft className="h-5 w-5 mr-2 transition-transform group-hover:-translate-x-1" />
              Back to Dashboard
            </button>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => navigate('/create-document')}
                className="w-full sm:w-auto btn-secondary flex items-center justify-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Document
              </button>
              
              {document.file_url && (
                <button
                  onClick={downloadFile}
                  className="w-full sm:w-auto btn-primary flex items-center justify-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </button>
              )}
            </div>
          </div>

          {/* Document Title and Status */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 mb-4 sm:mb-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  {document.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span>Created by {document.created_by_user?.full_name || 'Unknown'}</span>
                  <span>•</span>
                  <span>{format(new Date(document.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-start sm:items-end space-y-2">
                <span className={getStatusBadge(document.status)}>
                  {document.status.replace('_', ' ').toUpperCase()}
                </span>
                <div className="text-sm text-gray-500">
                  Progress: {getSignatureProgress()}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Admin Approval Section - Enhanced */}
            {document.requires_admin_approval && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
                  <div className="flex items-center text-white">
                    <Shield className="h-6 w-6 mr-3" />
                    <h2 className="text-xl font-semibold">Admin Approval Required</h2>
                  </div>
                </div>
                
                <div className="p-6">
                  {document.admin_approved === null ? (
                    // Pending approval
                    <div>
                      <div className="flex items-center mb-4">
                        <Clock className="h-5 w-5 text-orange-500 mr-2" />
                        <span className="text-orange-700 font-medium">Awaiting admin approval</span>
                      </div>
                      
                      {profile?.role === 'admin' ? (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <p className="text-orange-800 mb-4 font-medium">
                            As an admin, you can approve or reject this document:
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => handleAdminApproval(true)}
                              disabled={approvingDocument}
                              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
                            >
                              {approvingDocument ? (
                                <LoadingSpinner size="sm" className="mr-2" />
                              ) : (
                                <ThumbsUp className="h-5 w-5 mr-2" />
                              )}
                              Approve Document
                            </button>
                            <button
                              onClick={() => handleAdminApproval(false)}
                              disabled={approvingDocument}
                              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
                            >
                              {approvingDocument ? (
                                <LoadingSpinner size="sm" className="mr-2" />
                              ) : (
                                <ThumbsDown className="h-5 w-5 mr-2" />
                              )}
                              Reject Document
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-yellow-800">
                            This document is waiting for admin approval before signatures can be collected.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Approved or rejected
                    <div className={`border rounded-lg p-4 ${
                      document.admin_approved 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center mb-2">
                        {document.admin_approved ? (
                          <ShieldCheck className="h-6 w-6 text-green-600 mr-3" />
                        ) : (
                          <ShieldX className="h-6 w-6 text-red-600 mr-3" />
                        )}
                        <span className={`font-semibold text-lg ${
                          document.admin_approved ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {document.admin_approved ? 'Document Approved' : 'Document Rejected'}
                        </span>
                      </div>
                      
                      {document.admin_approved_at && (
                        <p className={`text-sm ${
                          document.admin_approved ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {document.admin_approved ? 'Approved' : 'Rejected'} on{' '}
                          {format(new Date(document.admin_approved_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}
                      
                      {document.admin_approved && (
                        <p className="text-green-700 text-sm mt-2">
                          ✓ Signatures can now be collected
                        </p>
                      )}
                      
                      {!document.admin_approved && (
                        <p className="text-red-700 text-sm mt-2">
                          ✗ Document cannot proceed until approved
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Document Information */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <div className="flex items-center text-white">
                  <FileText className="h-6 w-6 mr-3" />
                  <h2 className="text-xl font-semibold">Document Information</h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {document.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                    <p className="text-gray-600 leading-relaxed">{document.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Status</h3>
                    <span className={getStatusBadge(document.status)}>
                      {document.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">File</h3>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-600 text-sm">{document.file_name}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Created</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-600 text-sm">
                        {format(new Date(document.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Updated</h3>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-600 text-sm">
                        {format(new Date(document.updated_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Signatories Section */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-white">
                    <Users className="h-6 w-6 mr-3" />
                    <h2 className="text-xl font-semibold">
                      Signatories ({signatories.filter(s => s.is_signed).length}/{signatories.length} completed)
                    </h2>
                  </div>
                  <div className="text-white text-sm font-medium">
                    {getSignatureProgress()}%
                  </div>
                </div>
              </div>

              <div className="p-6">
                {signatories.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No signatories</h3>
                    <p className="mt-1 text-sm text-gray-500">No signatories have been added to this document.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div className="bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${getSignatureProgress()}%` }}
                      />
                    </div>

                    {/* Signatories List */}
                    <div className="space-y-4">
                      {signatories.map((signatory, index) => (
                        <div 
                          key={signatory.id} 
                          className={`border-2 rounded-xl p-4 transition-all duration-200 ${
                            signatory.is_signed 
                              ? 'border-green-200 bg-green-50' 
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                signatory.is_signed 
                                  ? 'bg-green-500 text-white' 
                                  : 'bg-gray-300 text-gray-600'
                              }`}>
                                {signatory.is_signed ? '✓' : index + 1}
                              </div>
                              
                              <div>
                                <h3 className="font-semibold text-gray-900">{signatory.name}</h3>
                                {signatory.position && (
                                  <p className="text-sm text-gray-600">{signatory.position}</p>
                                )}
                                <div className="flex items-center space-x-4 mt-1">
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

                            <div className="flex items-center space-x-2">
                              {signatory.is_signed ? (
                                <div className="flex items-center text-green-600">
                                  <CheckCircle className="h-5 w-5 mr-2" />
                                  <div className="text-right">
                                    <div className="text-sm font-medium">Signed</div>
                                    {signatory.signed_at && (
                                      <div className="text-xs text-gray-500">
                                        {format(new Date(signatory.signed_at), 'MMM d, h:mm a')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => updateSignatureStatus(signatory.id, true)}
                                    className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm font-medium"
                                  >
                                    Mark as Signed
                                  </button>
                                </div>
                              )}
                              
                              {signatory.is_signed && (
                                <button
                                  onClick={() => updateSignatureStatus(signatory.id, false)}
                                  className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm"
                                >
                                  Undo
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {signatory.notes && (
                            <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
                              <strong>Notes:</strong> {signatory.notes}
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
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                <div className="flex items-center text-white">
                  <MessageSquare className="h-6 w-6 mr-3" />
                  <h2 className="text-xl font-semibold">Comments ({comments.length})</h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Add Comment */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={addComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-2 rounded-lg flex items-center disabled:cursor-not-allowed transition-colors"
                    >
                      {submittingComment ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Add Comment
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No comments yet</h3>
                      <p className="mt-1 text-sm text-gray-500">Be the first to add a comment!</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                              <User className="h-4 w-4 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{comment.user?.full_name}</h4>
                              <p className="text-xs text-gray-500">
                                {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                          {comment.user?.role === 'admin' && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 ml-11">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Quick Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Signatories:</span>
                  <span className="font-semibold text-gray-900">{signatories.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-semibold text-green-600">
                    {signatories.filter(s => s.is_signed).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending:</span>
                  <span className="font-semibold text-yellow-600">
                    {signatories.filter(s => !s.is_signed).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-semibold text-blue-600">{getSignatureProgress()}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Comments:</span>
                  <span className="font-semibold text-gray-900">{comments.length}</span>
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Activity Log
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="text-gray-500 text-sm">No activity yet</p>
                ) : (
                  activity.map((item) => (
                    <div key={item.id} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{item.user?.full_name}</span>{' '}
                          {item.description}
                        </p>
                        <p className="text-xs text-gray-500">
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