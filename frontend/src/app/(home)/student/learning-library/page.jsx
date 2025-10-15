'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Play, FileText, Gamepad2, Film, ExternalLink, Search, Star, Sparkles, BookOpen, Image as ImageIcon, Loader2, RefreshCw, CheckCircle, X, Clock, Users, Bookmark, Share2, Heart, Eye, BarChart3, Award, Target, Zap, Calendar, EyeIcon } from 'lucide-react'
import { toast } from 'sonner'
import { clientAPI } from './api' // Import from the new api.js file
import LearningDialog from '@/components/ui/start-learning'
import LibraryDialog from '@/components/ui/library-dialog';


const gradients = {
  Math: 'from-yellow-300 via-orange-300 to-red-400',
  Science: 'from-green-300 via-blue-300 to-purple-400',
  English: 'from-pink-300 via-purple-300 to-indigo-400',
  History: 'from-amber-300 via-orange-400 to-red-400',
  Art: 'from-purple-300 via-pink-300 to-red-300',
  Geography: 'from-green-400 via-teal-400 to-blue-500',
  Physics: 'from-blue-400 via-indigo-400 to-purple-500',
  Chemistry: 'from-green-400 via-emerald-400 to-teal-500',
  Biology: 'from-green-300 via-lime-300 to-emerald-400',
  'Computer Science': 'from-gray-400 via-blue-400 to-indigo-500',
  'Social Studies': 'from-orange-300 via-red-300 to-pink-400',
  Music: 'from-purple-300 via-pink-300 to-red-300',
  'Physical Education': 'from-green-300 via-emerald-300 to-teal-400',
  'Foreign Languages': 'from-blue-300 via-indigo-300 to-purple-400',
  Business: 'from-gray-300 via-blue-300 to-indigo-400',
  Health: 'from-green-300 via-emerald-300 to-teal-400'
}

const typeCharacters = {
  slides: '📄',
  video: '🎥', 
  comic: '📖',
  image: '🖼️',
  content: '📝',
  assessment: '🎯',
  worksheet: '📝',
  quiz: '❓',
  external: '🔗'
}

// Add placeholder images for different content types
const contentPlaceholders = {
  slides: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop&crop=center',
  video: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=300&fit=crop&crop=center',
  comic: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop&crop=center',
  image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop&crop=center',
  content: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop&crop=center',
  assessment: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop&crop=center',
  worksheet: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop&crop=center',
  quiz: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop&crop=center',
  external: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop&crop=center',
  websearch: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop&crop=center'
}

const LibraryCharacter = () => (
  <div className="hidden lg:block absolute right-4 top-4">
    <div className="relative w-24 h-24">
      <div className="absolute -top-2 -right-2 text-xl" style={{ animation: 'gentle-spin 6s linear infinite' }}>⭐</div>
      <div className="absolute -top-6 right-2 text-lg" style={{ animation: 'gentle-pulse 3s ease-in-out infinite' }}>✨</div>
      <style jsx>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes gentle-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes gentle-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  </div>
)

const LearningLibrary = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [syncing, setSyncing] = useState(false)
  const [completedIds, setCompletedIds] = useState(new Set())
  const [selectedResource, setSelectedResource] = useState(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [isLearningDialogOpen, setIsLearningDialogOpen] = useState(false)
  const [currentResource, setCurrentResource] = useState(null)
  const [mounted, setMounted] = useState(false)

  const [resources, setResources] = useState([])
  const [stats, setStats] = useState({
    totalLessons: 0,
    completedLessons: 0,
    totalTimeSpent: 0,
    totalSubjects: 0
  })

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      loadResources()
      loadStats()
    }
  }, [mounted])

  const loadResources = async () => {
    try {
      const result = await clientAPI.getAllStudentContent()
      
      if (result.success) {
        setResources(result.lessons)
        // Update completed IDs based on progress
        const completed = new Set()
        result.lessons.forEach(lesson => {
          if (lesson.progress && lesson.progress.status === 'completed') {
            completed.add(lesson._id)
          }
        })
        setCompletedIds(completed)
      } else {
        toast.error(result.error || 'Failed to load resources')
      }
    } catch (error) {
      console.error('Error loading resources:', error)
      toast.error('Failed to load resources')
    }
  }

  const loadStats = async () => {
    try {
      const result = await clientAPI.getLessonStats()
      if (result.success) {
        setStats(result.stats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const syncResources = async () => {
    setSyncing(true)
    try {
      await loadResources()
      await loadStats()
      toast.success('Resources synced successfully! 🎉')
    } catch (error) {
      console.error('Error syncing resources:', error)
      toast.error('Failed to sync resources')
    } finally {
      setSyncing(false)
    }
  }

  const filteredResources = useMemo(() => {
    let filtered = [...resources]

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(resource => {
        const title = resource.title || ''
        const description = resource.description || ''
        const subject = resource.subject || ''
        
        return title.toLowerCase().includes(searchTerm.toLowerCase()) ||
               description.toLowerCase().includes(searchTerm.toLowerCase()) ||
               subject.toLowerCase().includes(searchTerm.toLowerCase())
      })
    }

    // Filter by resource type
    if (activeTab === 'external') {
      filtered = filtered.filter(resource => resource.resourceType === 'external' || resource.externalUrl)
    } else if (activeTab !== 'all') {
      filtered = filtered.filter(resource => resource.resourceType === activeTab)
    }

    return filtered
  }, [resources, searchTerm, activeTab])

  const getItemColor = (subject) => gradients[subject] || 'from-gray-300 to-gray-400'

  const handleReviewResource = (resource) => {
    // Close learning dialog if it's open
    setIsLearningDialogOpen(false)
    setCurrentResource(null)
    
    setSelectedResource(resource)
    setIsReviewDialogOpen(true)
  }

  const handleStartLearning = async (content) => {
    try {
      // Close review dialog if it's open
      setIsReviewDialogOpen(false)
      setSelectedResource(null)
      
      
      setCurrentResource(content)
      setIsLearningDialogOpen(true)
    } catch (error) {
      console.error('Error starting learning:', error)
      toast.error('Failed to start learning')
    }
  }

  const handleCloseLearning = () => {
    setIsLearningDialogOpen(false)
    setCurrentResource(null)
    // Reload resources to update progress
    loadResources()
  }

  const handleCompleteLearning = async (result) => {
    try {
      await clientAPI.updateStudentProgress(result.contentId, result.completionData)
      toast.success('Resource completed successfully! 🎉')
      // Reload resources to update progress
      loadResources()
      loadStats()
    } catch (error) {
      console.error('Error completing learning:', error)
      toast.error('Failed to complete learning')
    }
  }

  const getContentImage = (resource) => {
    switch (resource.resourceType) {
      case 'comic':
        // For comics, use the first panel image if available
        if (resource.imageUrls && resource.imageUrls.length > 0) {
          return resource.imageUrls[0];
        }
        if (resource.images && resource.images.length > 0) {
          return resource.images[0];
        }
        return contentPlaceholders.comic;
      
      case 'image':
        // For images, use the actual image
        if (resource.imageUrl) {
          return resource.imageUrl;
        }
        if (resource.images && resource.images.length > 0) {
          return resource.images[0];
        }
        return contentPlaceholders.image;
      
      case 'slides':
        // For slides, use the first slide image if available
        if (resource.slideImages && resource.slideImages.length > 0) {
          return resource.slideImages[0];
        }
        if (resource.images && resource.images.length > 0) {
          return resource.images[0];
        }
        return contentPlaceholders.slides;
      
      case 'video':
        // For videos, use thumbnail if available
        if (resource.thumbnailUrl) {
          return resource.thumbnailUrl;
        }
        if (resource.thumbnail) {
          return resource.thumbnail;
        }
        return contentPlaceholders.video;
      
      case 'external':
        return contentPlaceholders.external;
      
      case 'websearch':
        return contentPlaceholders.websearch;
      
      case 'content':
        return contentPlaceholders.content;
      
      case 'assessment':
        return contentPlaceholders.assessment;
      
      case 'worksheet':
      case 'quiz':
        return contentPlaceholders.assessment;
      
      default:
        return contentPlaceholders.content;
    }
  };

  const renderGrid = (resourceList) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {resourceList.map((resource, index) => {
        // Check completion status directly from resource progress data
        const isCompleted = resource.progress?.status === 'completed' || 
                           resource.progress?.completedAt ||
                           resource.progress?.percentage === 100 ||
                           (resource.progress && resource.progress.status === 'completed');
        
        const progress = resource.progress?.percentage || 0
        
        return (
          <motion.div
            key={`${resource._id}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -5 }}
          >
            <Card 
              className={`border-0 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-gray-800 overflow-hidden group cursor-pointer h-full flex flex-col p-0 ${
                isCompleted ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' : ''
              }`}
              onClick={() => handleStartLearning(resource)}
            >
              {/* Image Section - No padding, full width */}
              <div className="h-40 relative overflow-hidden">
                <img
                  src={getContentImage(resource)}
                  alt={resource.title || "Learning Resource"}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    e.target.src = contentPlaceholders[resource.resourceType] || contentPlaceholders.content;
                  }}
                />
                {/* Overlay badges */}
                <div className="absolute top-2 left-2">
                  <Badge className="bg-black/70 text-white border-0 text-xs font-semibold backdrop-blur-sm">
                    {typeCharacters[resource.resourceType] || '📄'} {resource.resourceType}
                  </Badge>
                </div>
                {isCompleted && (
                  <div className="absolute right-2 top-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReviewResource(resource)}
                      className="bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 shadow-lg"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Review
                    </Button>
                  </div>
                )}
                <div className="absolute bottom-2 left-2">
                  <Badge className="bg-black/20 text-white border-0 text-xs font-semibold backdrop-blur-sm">
                    ⭐ {resource.rating}
                  </Badge>
                </div>
              </div>
              
              {/* Content Section - With padding */}
              <CardContent className="p-3 h-full flex flex-col">
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="font-bold text-base text-gray-800 dark:text-white line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {resource.title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
                      {resource.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`bg-gradient-to-r ${getItemColor(resource.subject)} text-white border-0 font-semibold text-xs`}>
                      {resource.subject}
                    </Badge>
                    <Badge variant="outline" className="text-xs"> {resource.grade}</Badge>
                    <Badge variant="outline" className="text-xs">{resource.difficulty}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {resource.estimatedTimeMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {resource.views}
                    </span>
                  </div>

                  {/* Progress indicator */}
                  {!isCompleted && progress > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                        <span>Progress</span>
                        <span>{Math.floor(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                </div>
                
                {/* Button Section - Fixed at bottom */}
                <div className="mt-3 space-y-2">
                  <Button 
                    className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isCompleted) {
                        handleReviewResource(resource)
                      } else {
                        handleStartLearning(resource)
                      }
                    }}
                  >
                    <Play className="mr-2 h-3 w-3" />
                    {isCompleted ? 'Review' : 'Start Learning!'} 🚀  
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )

  const getTabIcon = (tabValue) => {
    switch(tabValue) {
      case 'all': return <Sparkles className="mr-1 h-4 w-4" />
      case 'slides': return <FileText className="mr-1 h-4 w-4" />
      case 'video': return <Film className="mr-1 h-4 w-4" />
      case 'comic': return <BookOpen className="mr-1 h-4 w-4" />
      case 'image': return <ImageIcon className="mr-1 h-4 w-4" />
      case 'content': return <FileText className="mr-1 h-4 w-4" />
      case 'assessment': return <Gamepad2 className="mr-1 h-4 w-4" />
      case 'worksheet': return <FileText className="mr-1 h-4 w-4" />
      case 'quiz': return <Gamepad2 className="mr-1 h-4 w-4" />
      case 'external': return <ExternalLink className="mr-1 h-4 w-4" />
      default: return <FileText className="mr-1 h-4 w-4" />
    }
  }

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 relative">
        <LibraryCharacter />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Your Learning Library 📚
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Discover amazing educational content across all subjects! From interactive slides to fun videos, 
            everything you need to learn and grow is right here. 🌟
          </p>
        </motion.div>

        <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm mb-8">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  Explore Your Content 🌟
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Search and discover amazing learning resources!
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  suppressHydrationWarning
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap justify-start gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-3">
            {['all', 'slides', 'video', 'comic', 'image', 'content', 'assessment', 'worksheet', 'quiz', 'external'].map((tab, index) => (
              <TabsTrigger 
                key={tab}
                value={tab} 
                className={`flex items-center rounded-xl font-semibold text-xs px-4 py-2 transition-all data-[state=active]:text-white shadow-sm ${
                  index === 0 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-400 data-[state=active]:to-pink-500' :
                  index === 1 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-400 data-[state=active]:to-purple-500' :
                  index === 2 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-400 data-[state=active]:to-blue-500' :
                  index === 3 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-400 data-[state=active]:to-red-500' :
                  index === 4 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-orange-500' :
                  index === 5 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-400 data-[state=active]:to-blue-500' :
                  index === 6 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-400 data-[state=active]:to-pink-500' :
                  index === 7 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-400 data-[state=active]:to-teal-500' :
                  index === 8 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-400 data-[state=active]:to-indigo-500' :
                  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-400 data-[state=active]:to-pink-500'
                }`}
              >
                {getTabIcon(tab)}
                <span className="hidden sm:inline capitalize">{tab === 'external' ? 'Links' : tab}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {['all', 'slides', 'video', 'comic', 'image', 'content', 'assessment', 'worksheet', 'quiz'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {filteredResources.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-16"
                >
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">No {tab === 'all' ? 'content' : tab} found</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                    Try adjusting your filters or sync more content to discover amazing {tab === 'all' ? 'content' : tab}!
                  </p>
                  <Button 
                    onClick={syncResources} 
                    disabled={syncing} 
                    className="rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
                    suppressHydrationWarning
                  >
                    {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync More Content
                  </Button>
                </motion.div>
              ) : (
                renderGrid(filteredResources)
              )}
            </TabsContent>
          ))}

          <TabsContent value="external">
            <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <div className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 px-6 py-6 rounded-t-3xl">
                <CardTitle className="text-white text-2xl font-bold flex items-center gap-3">
                  <ExternalLink className="h-6 w-6" /> Amazing External Resources!
                </CardTitle>
                <CardDescription className="text-white/90 text-base font-medium mt-2">
                  Fun links and activities for you! 🌟
                </CardDescription>
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                      <Award className="h-5 w-5 text-blue-500" />
                      Educational Websites 🎓
                    </h3>
                    {[
                      { name: 'Khan Academy Kids ', url: 'https://www.khanacademy.org/kids', color: 'from-blue-500 to-purple-500' },
                      { name: 'Scratch Programming ', url: 'https://scratch.mit.edu', color: 'from-orange-500 to-red-500' },
                      { name: 'NASA Kids Club ', url: 'https://www.nasa.gov/kidsclub', color: 'from-indigo-500 to-blue-500' }
                    ].map((site, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-800 dark:to-purple-800 rounded-2xl p-4 flex items-center justify-between shadow-md hover:shadow-lg transition-all duration-300"
                      >
                        <span className="font-semibold text-sm text-gray-800 dark:text-white truncate">{site.name}</span>
                        <Button 
                          className={`rounded-full bg-gradient-to-r ${site.color} text-white text-xs font-semibold px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300`}
                          onClick={() => window.open(site.url, '_blank')}
                          suppressHydrationWarning
                        >
                          Visit! 🌟
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                      <Target className="h-5 w-5 text-pink-500" />
                      Fun Activities 🎨
                    </h3>
                    {[
                      { name: 'Art & Crafts 🎨', url: '#', color: 'from-pink-500 to-orange-500' },
                      { name: 'Science Experiments 🧪', url: '#', color: 'from-green-500 to-teal-500' },
                      { name: 'Math Puzzles 🧩', url: '#', color: 'from-purple-500 to-indigo-500' }
                    ].map((activity, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-gradient-to-r from-pink-100 to-orange-100 dark:from-pink-800 dark:to-orange-800 rounded-2xl p-4 flex items-center justify-between shadow-md hover:shadow-lg transition-all duration-300"
                      >
                        <span className="font-semibold text-sm text-gray-800 dark:text-white truncate">{activity.name}</span>
                        <Button className={`rounded-full bg-gradient-to-r ${activity.color} text-white text-xs font-semibold px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300`} suppressHydrationWarning>
                          Try It! 🚀
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-6 mt-8"
        >
          {[
            { icon: '📄', value: stats.totalLessons, label: 'Amazing Resources!', color: 'from-yellow-300 to-orange-400' },
            { icon: '⏰', value: stats.totalTimeSpent, label: 'Minutes of Fun!', color: 'from-green-300 to-blue-400' },
            { icon: '🎓', value: stats.totalSubjects, label: 'Subjects to Explore!', color: 'from-purple-300 to-pink-400' },
            { icon: '✅', value: stats.completedLessons, label: 'Completed Items!', color: 'from-emerald-300 to-teal-400' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <Card 
                className={`border-0 rounded-3xl shadow-xl bg-gradient-to-br ${stat.color} text-white overflow-hidden`}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-3">{stat.icon}</div>
                  <p className="text-2xl font-bold mb-1">{stat.value}</p>
                  <p className="text-sm font-medium">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Learning Dialog - Only for non-completed content */}
      {currentResource && (
      <LearningDialog
          key={currentResource._id}
        isOpen={isLearningDialogOpen}
        onClose={handleCloseLearning}
        content={currentResource}
        onComplete={handleCompleteLearning}
        studentProgress={currentResource}
      />
      )}

      {/* Review Dialog for completed content */}
      {selectedResource && (
      <LibraryDialog
          key={`review-${selectedResource._id}`}
        isOpen={isReviewDialogOpen}
        onClose={() => setIsReviewDialogOpen(false)}
        content={selectedResource}
        isReviewMode={true}
        studentAnswers={selectedResource?.progress?.completionData?.answers || {}}
        evaluationResults={selectedResource?.progress?.completionData?.evaluationResults || {}}
      />
      )}
      
    </div>
  )
}

export default LearningLibrary