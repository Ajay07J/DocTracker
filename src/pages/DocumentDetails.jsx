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
  X
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
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const updateSignatureStatus = async (signatoryId, isSigned, notes = '') => {
    try {
      const updateData = {
        is_signed: isSigned,
        signed_at: isSigned ? new Date().toISOString() : null,
        notes: notes || null
      }

      const { error } = await supabase
        .from('document_signatories')
        .update(updateData)
        .eq('id', signatoryId)

      if (error) throw error

      // Log activity
      const signatory = signatories.find(s => s.id === signatoryId)
      await supabase
        .from('document_activity')
        .insert([{
          document_id: id,
          user_id: user.id,
          action: isSigned ? 'signature_marked' : 'signature_unmarked',
          description: `Marked ${signatory.name} as ${isSigned ? 'signed' : 'not signed'}`
        }])

      // Update document status if all signatures are complete
      const updatedSignatories = signatories.map(s => 
        s.id === signatoryId ? { ...s, ...updateData } : s
      )
      
      const allSigned = updatedSignatories.every(s => s.is_signed)
      if (allSigned && document.status !== 'completed') {
        await supabase
          .from('documents')
          .update({ status: 'completed' })
          .eq('id', id)
        
        setDocument(prev => ({ ...prev, status: 'completed' }))
      } else if (!allSigned && document.status === 'completed') {
        await supabase
          .from('documents')
          .update({ status: 'in_progress' })
          .eq('id', id)
        
        setDocument(prev => ({ ...prev, status: 'in_progress' }))
      }

      setSignatories(updatedSignatories)
      toast.success(isSigned ? 'Signature marked as completed' : 'Signature unmarked')
      fetchDocumentDetails() // Refresh to get updated activity
    } catch (error) {
      console.error('Error updating signature status:', error)
      toast.error('Failed to update signature status')
    }
  }

  const handleAdminApproval = async (approved) => {
    try {
      const updateData = {
        admin_approved: approved,
        admin_approved_by: approved ? user.id : null,
        admin_approved_at: approved ? new Date().toISOString() : null
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
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const getSignatureProgress = () => {
    const signed = signatories.filter(s => s.is_signed).length
    const total = signatories.length
    const percentage = total > 0 ? Math.round((signed / total) * 100) : 0
    return { signed, total, percentage }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Document not found</h3>
          <p className="mt-1 text-sm text-gray-500">The document you're looking for doesn't exist.</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const progress = getSignatureProgress()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Dashboard
        </button>
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{document.name}</h1>
              <span className={getStatusBadge(document.status)}>
                {document.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600">
              Created by {document.created_by_user?.full_name} on{' '}
              {format(new Date(document.created_at), 'MMMM d, yyyy')}
            </p>
          </div>
          
          <div className="mt-4 lg:mt-0 flex items-center space-x-3">
            {document.file_url && (
              <a
                href={document.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Download File
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Document Information */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Information</h2>
            
            {document.description && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                <p className="text-gray-600">{document.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className="ml-2 text-gray-600">{document.status.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">File:</span>
                <span className="ml-2 text-gray-600">{document.file_name || 'No file attached'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <span className="ml-2 text-gray-600">
                  {format(new Date(document.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Updated:</span>
                <span className="ml-2 text-gray-600">
                  {format(new Date(document.updated_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>

            {/* Admin Approval Section */}
            {document.requires_admin_approval && (
              <div className="mt-6 p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 text-yellow-600 mr-2" />
                    <span className="font-medium text-yellow-800">Admin Approval Required</span>
                  </div>
                  
                  {document.admin_approved !== null ? (
                    <div className={`flex items-center ${
                      document.admin_approved ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {document.admin_approved ? (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      <span className="text-sm font-medium">
                        {document.admin_approved ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                  ) : (
                    profile?.role === 'admin' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleAdminApproval(false)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleAdminApproval(true)}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                        >
                          Approve
                        </button>
                      </div>
                    )
                  )}
                </div>
                
                {document.admin_approved !== null && (
                  <p className="mt-2 text-sm text-gray-600">
                    {document.admin_approved ? 'Approved' : 'Rejected'} on{' '}
                    {format(new Date(document.admin_approved_at), 'MMM d, yyyy h:mm a')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Signatories */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Users className="h-6 w-6 text-primary-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Signatories</h2>
              </div>
              <div className="text-sm text-gray-600">
                {progress.signed}/{progress.total} completed ({progress.percentage}%)
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-4">
              {signatories.map((signatory, index) => (
                <div
                  key={signatory.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    signatory.is_signed 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="font-medium text-gray-900">{signatory.name}</h3>
                          {signatory.position && (
                            <p className="text-sm text-gray-600">{signatory.position}</p>
                          )}
                        </div>
                        {signatory.is_signed && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                        {signatory.email && (
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-1" />
                            {signatory.email}
                          </div>
                        )}
                        {signatory.phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-1" />
                            {signatory.phone}
                          </div>
                        )}
                      </div>

                      {signatory.is_signed && signatory.signed_at && (
                        <p className="mt-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4 inline mr-1" />
                          Signed on {format(new Date(signatory.signed_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}

                      {signatory.notes && (
                        <p className="mt-2 text-sm text-gray-600 italic">
                          Note: {signatory.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateSignatureStatus(
                          signatory.id, 
                          !signatory.is_signed,
                          prompt('Add a note (optional):') || ''
                        )}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          signatory.is_signed
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {signatory.is_signed ? 'Mark as Not Signed' : 'Mark as Signed'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <MessageSquare className="h-6 w-6 text-primary-600 mr-2" />
              Comments ({comments.length})
            </h2>

            {/* Add Comment */}
            <div className="mb-6">
              <div className="flex space-x-3">
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
                <button
                  onClick={addComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="btn-primary h-fit flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingComment ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="border-l-4 border-primary-200 pl-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{comment.user.full_name}</span>
                        {comment.user.role === 'admin' && (
                          <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-gray-700">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Activity Log */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h3>
            <div className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-gray-500 text-sm">No activity yet.</p>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="text-sm">
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        <p className="text-gray-900">
                          <span className="font-medium">{item.user?.full_name || 'System'}</span>{' '}
                          {item.description}
                        </p>
                        <p className="text-gray-500">
                          {format(new Date(item.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Signatories:</span>
                <span className="font-medium">{signatories.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed:</span>
                <span className="font-medium text-green-600">{progress.signed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pending:</span>
                <span className="font-medium text-yellow-600">{progress.total - progress.signed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Progress:</span>
                <span className="font-medium">{progress.percentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Comments:</span>
                <span className="font-medium">{comments.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentDetails