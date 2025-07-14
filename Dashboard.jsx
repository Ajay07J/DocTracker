import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, FileText, Clock, CheckCircle, AlertCircle, Users, Download, Eye } from 'lucide-react'
import { format } from 'date-fns'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { profile } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  })

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      
      // Fetch documents with creator info and signatory count
      const { data: documentsData, error } = await supabase
        .from('documents')
        .select(`
          *,
          created_by_user:users!created_by(full_name),
          signatories:document_signatories(id, is_signed)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Calculate stats
      const totalDocs = documentsData.length
      const pendingDocs = documentsData.filter(doc => doc.status === 'pending').length
      const inProgressDocs = documentsData.filter(doc => doc.status === 'in_progress').length
      const completedDocs = documentsData.filter(doc => doc.status === 'completed').length

      setStats({
        total: totalDocs,
        pending: pendingDocs,
        inProgress: inProgressDocs,
        completed: completedDocs
      })

      setDocuments(documentsData)
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast.error('Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium"
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

  const getSignatureProgress = (signatories) => {
    if (!signatories || signatories.length === 0) return { signed: 0, total: 0, percentage: 0 }
    
    const signed = signatories.filter(s => s.is_signed).length
    const total = signatories.length
    const percentage = total > 0 ? Math.round((signed / total) * 100) : 0
    
    return { signed, total, percentage }
  }

  const filteredDocuments = documents.filter(doc => {
    if (filter === 'all') return true
    return doc.status === filter
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Welcome back, {profile?.full_name}! Manage your club's document tracking.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link to="/create-document" className="btn-primary flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              New Document Tracker
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'all', label: 'All Documents' },
              { key: 'pending', label: 'Pending' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'completed', label: 'Completed' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  filter === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {tab.key === 'all' ? stats.total : stats[tab.key]}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'all' 
              ? "Get started by creating your first document tracker."
              : `No documents with ${filter.replace('_', ' ')} status.`
            }
          </p>
          
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredDocuments.map((document) => {
            const progress = getSignatureProgress(document.signatories)
            
            return (
              <div key={document.id} className="card p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(document.status)}
                      <h3 className="text-lg font-semibold text-gray-900">
                        {document.name}
                      </h3>
                      <span className={getStatusBadge(document.status)}>
                        {document.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    {document.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {document.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span>Created by {document.created_by_user?.full_name}</span>
                      <span>•</span>
                      <span>{format(new Date(document.created_at), 'MMM d, yyyy')}</span>
                      
                      {document.signatories && document.signatories.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {progress.signed}/{progress.total} signatures ({progress.percentage}%)
                            </span>
                          </div>
                        </>
                      )}
                      
                      {document.requires_admin_approval && (
                        <>
                          <span>•</span>
                          <span className={`flex items-center space-x-1 ${
                            document.admin_approved ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {document.admin_approved ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            <span>
                              {document.admin_approved ? 'Admin Approved' : 'Awaiting Admin Approval'}
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {document.signatories && document.signatories.length > 0 && (
                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {document.file_url && (
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                        title="Download file"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    )}
                    
                    <Link
                      to={`/document/${document.id}`}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      title="View details"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Dashboard